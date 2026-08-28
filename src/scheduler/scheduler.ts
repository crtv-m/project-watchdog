import { scenarioService } from '../services/scenarioService.js';
import { executeScenario, getActiveCount } from './executor.js';
import { logger } from '../utils/logger.js';

const maxConcurrent = Number(process.env.MAX_CONCURRENT_CHECKS ?? 10);
const pollInterval = Number(process.env.POLL_INTERVAL_MS ?? 2000);
let stopped = false;
let wakeScheduler: (() => void) | undefined;
const activeTasks = new Set<Promise<void>>();

export async function runScheduler() {
  logger.info({ maxConcurrent, pollInterval }, 'Worker started');
  while (!stopped) {
    try {
      const due = await scenarioService.due();
      const capacity = Math.max(0, maxConcurrent - getActiveCount());
      for (const scenario of due.slice(0, capacity)) {
        if (stopped) break;
        const task = executeScenario(scenario).finally(() => { activeTasks.delete(task); wakeScheduler?.(); });
        activeTasks.add(task);
      }
    } catch (err) {
      logger.error({ err }, 'Scheduler poll failed');
    }
    if (!stopped) await new Promise<void>((resolve) => { const timer = setTimeout(resolve, pollInterval); wakeScheduler = () => { clearTimeout(timer); resolve(); }; });
  }
  await Promise.all([...activeTasks]);
}

export function stopScheduler() { stopped = true; wakeScheduler?.(); }
