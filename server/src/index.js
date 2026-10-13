const config = require('./config');
const { createDb } = require('./db/pool');
const { createContainer } = require('./container');
const { createApp } = require('./app');

async function main() {
  const db = createDb(config.sqlitePath);

  try {
    await db.query('SELECT 1');
  } catch (err) {
    console.error('Could not open the SQLite database.');
    console.error(`Path: ${config.sqlitePath}`);
    console.error(err.message);
    process.exit(1);
  }

  const container = createContainer({ db });
  const app = createApp(container);

  const server = app.listen(config.port, () => {
    console.log(`Community Connect API listening on http://localhost:${config.port}`);
    console.log(`SQLite: ${config.sqlitePath}`);
    console.log(`Environment: ${config.env} | FCM push: ${container.push.enabled ? 'enabled' : 'disabled'}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
      await db.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
