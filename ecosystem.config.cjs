module.exports = {
  apps: [
    { name: 'project-watchdog-api', script: 'dist/server.js', autorestart: true },
    { name: 'project-watchdog-worker', script: 'dist/worker.js', autorestart: true }
  ]
};
