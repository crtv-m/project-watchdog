import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { join } from 'node:path';
import { scenarioService, type ScenarioInput } from './services/scenarioService.js';
import { resultService } from './services/resultService.js';
import { prisma } from './database/prisma.js';
import { logger } from './utils/logger.js';

const app = Fastify({ loggerInstance: logger });
app.register(fastifyStatic, { root: join(process.cwd(), 'public'), prefix: '/' });
const input = (request: { body: unknown }) => request.body as ScenarioInput;
app.get('/api/scenarios', async () => scenarioService.list());
app.post('/api/scenarios', async (request, reply) => { try { return reply.code(201).send(await scenarioService.create(input(request))); } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Invalid input' }); } });
app.get<{ Params: { id: string } }>('/api/scenarios/:id', async (request, reply) => { const item = await scenarioService.get(request.params.id); return item ? item : reply.code(404).send({ error: 'Scenario not found' }); });
app.put<{ Params: { id: string } }>('/api/scenarios/:id', async (request, reply) => { try { return await scenarioService.update(request.params.id, input(request)); } catch (err) { return reply.code(400).send({ error: err instanceof Error ? err.message : 'Invalid input' }); } });
app.delete<{ Params: { id: string } }>('/api/scenarios/:id', async (request) => scenarioService.remove(request.params.id));
app.post<{ Params: { id: string } }>('/api/scenarios/:id/run', async (request, reply) => { const item = await scenarioService.get(request.params.id); if (!item) return reply.code(404).send({ error: 'Scenario not found' }); const updated = await prisma.scenario.update({ where: { id: item.id }, data: { nextRunAt: new Date() } }); return reply.code(202).send({ accepted: true, nextRunAt: updated.nextRunAt }); });
app.get<{ Params: { id: string } }>('/api/scenarios/:id/results', async (request) => resultService.list(request.params.id));
app.get<{ Querystring: { limit?: string } }>('/api/results/recent', async (request) => { const parsedLimit = Number(request.query.limit ?? 30); const limit = Number.isFinite(parsedLimit) ? Math.min(30, Math.max(1, Math.floor(parsedLimit))) : 30; return resultService.recentResponseTimes(limit); });

const close = async () => { await app.close(); await prisma.$disconnect(); };
process.on('SIGTERM', close); process.on('SIGINT', close);
const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: process.env.HOST ?? '127.0.0.1' }).then(() => logger.info({ port }, 'API started')).catch(async (err) => { logger.error(err); await prisma.$disconnect(); process.exit(1); });
