import { prisma } from '../database/prisma.js';
import { evaluateCheck } from '../checks/checks.js';
import { logger } from '../utils/logger.js';
import { pruneResults } from '../services/resultService.js';
import type { Scenario } from '@prisma/client';

const running = new Set<string>();
const executions = new Set<Promise<void>>();
export const isRunning = (id: string) => running.has(id);
export const getActiveCount = () => executions.size;
export async function waitForExecutions() { while (executions.size > 0) await Promise.all([...executions]); }

async function runScenario(scenario: Scenario) {
  if (running.has(scenario.id)) return;
  const scheduledAt = scenario.nextRunAt;
  const lockUntil = new Date(Date.now() + (scenario.timeout + 30) * 1000);
  const claimed = await prisma.scenario.updateMany({
    where: { id: scenario.id, OR: [{ runLockUntil: null }, { runLockUntil: { lt: new Date() } }] },
    data: { runLockUntil: lockUntil }
  });
  if (claimed.count === 0) return;
  running.add(scenario.id);
  const startedAt = new Date();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), scenario.timeout * 1000);
  let status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'ERROR' = 'ERROR';
  let httpStatus: number | undefined;
  let responseTime: number | undefined;
  let error: string | undefined;
  try {
    const response = await fetch(scenario.url, { method: scenario.method, signal: controller.signal });
    responseTime = Date.now() - startedAt.getTime();
    httpStatus = response.status;
    const body = scenario.checkType === 'BODY_CONTAINS' || scenario.checkType === 'BODY_NOT_CONTAINS' ? await response.text() : '';
    status = evaluateCheck({ type: scenario.checkType, expectedValue: scenario.expectedValue, httpStatus, responseTime, body }) ? 'SUCCESS' : 'FAILED';
  } catch (cause) {
    status = cause instanceof Error && cause.name === 'AbortError' ? 'TIMEOUT' : 'ERROR';
    error = cause instanceof Error ? cause.message : String(cause);
  } finally {
    clearTimeout(timer);
    try {
      await prisma.$transaction([
        prisma.checkResult.create({ data: { scenarioId: scenario.id, startedAt, finishedAt: new Date(), status, httpStatus, responseTime, error } }),
        prisma.scenario.updateMany({ where: { id: scenario.id, nextRunAt: scheduledAt, runLockUntil: lockUntil }, data: { lastRunAt: startedAt, nextRunAt: new Date(Date.now() + scenario.interval * 1000), runLockUntil: null } }),
        prisma.scenario.updateMany({ where: { id: scenario.id, nextRunAt: { not: scheduledAt }, runLockUntil: lockUntil }, data: { lastRunAt: startedAt, runLockUntil: null } })
      ]);
      await pruneResults(scenario.id);
    } catch (cause) {
      logger.error({ err: cause, scenarioId: scenario.id }, 'Could not persist check result');
    }
    running.delete(scenario.id);
  }
}

export function executeScenario(scenario: Scenario) {
  const execution = runScenario(scenario).catch((cause) => { logger.error({ err: cause, scenarioId: scenario.id }, 'Scenario execution failed'); }).finally(() => executions.delete(execution));
  executions.add(execution);
  return execution;
}
