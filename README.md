# projectWatchdog

Local web-project monitoring with an independent Fastify API and scheduler worker.

## Run locally

```sh
npm install
npm run db:generate
npm run db:push
npm run build
npm run dev:api
# in another terminal
npm run dev:worker
```

Open http://localhost:3000. The API and worker share only SQLite through Prisma. The browser contains no scheduling logic, so closing it does not stop checks.

For production, build first and start both processes with `npm run pm2:start`.
