import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
const db = await PGlite.create(process.env.LOCAL_DB_DIR || '.local-db');
const server = new PGLiteSocketServer({
  db,
  host: '127.0.0.1',
  port: Number(process.env.LOCAL_DB_PORT || 54329),
  maxConnections: 10,
});
await server.start();
console.log('Local development PostgreSQL ready on 127.0.0.1:54329. Data persists in .local-db.');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
