import { prisma } from './database/prisma.js';
import { runScheduler, stopScheduler } from './scheduler/scheduler.js';
import { waitForExecutions } from './scheduler/executor.js';
import { logger } from './utils/logger.js';

let shuttingDown = false;
const shutdownTimeout = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 30000);
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Worker shutdown requested');
  stopScheduler();
  const completed = Promise.all([schedulerPromise, waitForExecutions()]);
  await Promise.race([completed, new Promise((resolve) => setTimeout(resolve, shutdownTimeout))]);
  await prisma.$disconnect();
  logger.info('Worker stopped');
  process.exit(0);
}
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => void shutdown(signal));

const schedulerPromise = runScheduler();
schedulerPromise.catch(async (err) => { logger.error({ err }, 'Worker crashed'); await prisma.$disconnect(); process.exit(1); });
