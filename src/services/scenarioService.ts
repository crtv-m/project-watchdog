import { prisma } from '../database/prisma.js';
import type { CheckType } from '@prisma/client';

export type ScenarioInput = {
  name: string;
  url: string;
  method?: string;
  checkType: CheckType;
  expectedValue: string;
  interval?: number;
  timeout?: number;
  enabled?: boolean;
};

function normalize(input: ScenarioInput) {
  const parsedUrl = new URL(input.url);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported');
  if (!input.name?.trim() || !input.expectedValue?.trim()) throw new Error('Name and expected value are required');
  if ((input.interval ?? 60) < 1 || (input.timeout ?? 10) < 1) throw new Error('Interval and timeout must be positive');
  return {
    name: input.name.trim(), url: parsedUrl.toString(), method: input.method ?? 'GET',
    checkType: input.checkType, expectedValue: input.expectedValue,
    interval: Math.floor(input.interval ?? 60), timeout: Math.floor(input.timeout ?? 10), enabled: input.enabled ?? true
  };
}

export const scenarioService = {
  list: () => prisma.scenario.findMany({ orderBy: { createdAt: 'desc' }, include: { results: { orderBy: { startedAt: 'desc' }, take: 1 } } }),
  get: (id: string) => prisma.scenario.findUnique({ where: { id }, include: { results: { orderBy: { startedAt: 'desc' }, take: 100 } } }),
  create: (input: ScenarioInput) => prisma.scenario.create({ data: { ...normalize(input), nextRunAt: new Date() } }),
  update: (id: string, input: ScenarioInput) => prisma.scenario.update({ where: { id }, data: normalize(input) }),
  remove: (id: string) => prisma.scenario.delete({ where: { id } }),
  due: () => { const now = new Date(); return prisma.scenario.findMany({ where: { enabled: true, nextRunAt: { lte: now }, OR: [{ runLockUntil: null }, { runLockUntil: { lt: now } }] }, orderBy: { nextRunAt: 'asc' } }); }
};
