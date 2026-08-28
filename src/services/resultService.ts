import { prisma } from '../database/prisma.js';

const maxResults = Number(process.env.MAX_RESULTS_PER_SCENARIO ?? 1000);

export async function pruneResults(scenarioId: string) {
  const stale = await prisma.checkResult.findMany({
    where: { scenarioId }, orderBy: { startedAt: 'desc' }, skip: maxResults, select: { id: true }
  });
  if (stale.length) await prisma.checkResult.deleteMany({ where: { id: { in: stale.map((result) => result.id) } } });
}

export const resultService = {
  list: (scenarioId: string) => prisma.checkResult.findMany({ where: { scenarioId }, orderBy: { startedAt: 'desc' }, take: 100 }),
  recentResponseTimes: async (limit: number) => {
    const results = await prisma.checkResult.findMany({
      where: { responseTime: { not: null } },
      orderBy: { startedAt: 'desc' },
      select: { scenarioId: true, startedAt: true, responseTime: true }
    });
    const grouped = new Map<string, Array<{ startedAt: Date; responseTime: number }>>();
    for (const result of results) {
      const values = grouped.get(result.scenarioId) ?? [];
      if (values.length < limit) values.push({ startedAt: result.startedAt, responseTime: result.responseTime as number });
      grouped.set(result.scenarioId, values);
    }
    return Object.fromEntries([...grouped].map(([scenarioId, values]) => [scenarioId, values.reverse()]));
  },
  pruneResults
};
