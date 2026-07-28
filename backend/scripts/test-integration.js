// One-off integration test: exercises the REAL server code (routes, socket
// handlers, db queries) against an in-memory Postgres emulator (pg-mem),
// so we can verify end-to-end behavior without a system Postgres install.
import { newDb } from 'pg-mem';
import fs from 'fs';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';

async function main() {
  // 1. Build an in-memory Postgres and load our real schema.
  const mem = newDb();
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid',
    implementation: () => crypto.randomUUID(),
    impure: true,
  });
  const schema = fs.readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf-8');
  mem.public.none(schema);

  // 2. Get a node-postgres-compatible Pool backed by the in-memory db,
  // and monkey-patch it into our pool module before other modules import it.
  const { Pool } = mem.adapters.createPg();
  const poolModule = await import('../src/db/pool.js');
  const realPool = poolModule.default;
  // Redirect all query calls on the real pool to the in-memory one.
  const memPool = new Pool();
  realPool.query = memPool.query.bind(memPool);

  // 3. Boot the real app (same code as server.js, without dotenv/env port binding).
  const documentsRouter = (await import('../src/routes/documents.js')).default;
  const { registerCollabHandlers } = await import('../src/sockets/collabSocket.js');

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api/documents', documentsRouter);
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  registerCollabHandlers(io);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test server listening on ${baseUrl}`);

  let failures = 0;
  function assert(cond, msg) {
    if (!cond) {
      console.error(`FAIL: ${msg}`);
      failures++;
    } else {
      console.log(`PASS: ${msg}`);
    }
  }

  // --- Test 1: create a document via REST ---
  const createRes = await fetch(`${baseUrl}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Integration Test Doc' }),
  });
  const doc = await createRes.json();
  assert(createRes.status === 201, 'create document returns 201');
  assert(!!doc.id, 'created document has an id');
  assert(doc.title === 'Integration Test Doc', 'created document has correct title');

  // --- Test 2: fetch it back ---
  const getRes = await fetch(`${baseUrl}/api/documents/${doc.id}`);
  const fetched = await getRes.json();
  assert(getRes.status === 200, 'fetch document returns 200');
  assert(fetched.content === '', 'new document has empty content');

  // --- Test 3: two socket clients join and collaborate ---
  const clientA = ioClient(baseUrl);
  const clientB = ioClient(baseUrl);

  await Promise.all([
    new Promise((res) => clientA.on('connect', res)),
    new Promise((res) => clientB.on('connect', res)),
  ]);

  const aState = new Promise((res) => clientA.once('document-state', res));
  const bState = new Promise((res) => clientB.once('document-state', res));
  clientA.emit('join-document', { documentId: doc.id, userName: 'Alice' });
  clientB.emit('join-document', { documentId: doc.id, userName: 'Bob' });
  const [stateA, stateB] = await Promise.all([aState, bState]);

  assert(stateA.content === '', 'client A gets initial empty content');
  assert(!!stateA.you.color, 'client A assigned a color');
  assert(stateA.you.color !== stateB.you.color, 'clients A and B get different colors');

  // Wait for presence broadcast to settle (both users should see each other).
  // Note: server broadcasts the RAW room list (including the recipient
  // themself) - the React hook filters out "self" client-side. So from
  // clientB's raw event, we expect 2 entries: Alice and Bob.
  const bSeesA = new Promise((res) => {
    clientB.on('users-updated', (list) => {
      if (list.some((u) => u.userName === 'Alice')) res(list);
    });
  });
  const usersFromB = await bSeesA;
  assert(usersFromB.length === 2, 'client B\'s raw room list has both Alice and Bob');
  assert(usersFromB.some((u) => u.userName === 'Bob'), 'raw list includes Bob himself (filtered client-side in the real app)');

  // --- Test 4: content change broadcasts to the other client ---
  const bReceivesEdit = new Promise((res) => clientB.once('content-change', res));
  clientA.emit('content-change', { documentId: doc.id, content: 'Hello from Alice' });
  const editReceived = await bReceivesEdit;
  assert(editReceived.content === 'Hello from Alice', 'client B receives client A\'s edit in real time');

  // --- Test 5: cursor move broadcasts ---
  const bReceivesCursor = new Promise((res) => clientB.once('cursor-update', res));
  clientA.emit('cursor-move', { documentId: doc.id, cursorIndex: 5 });
  const cursorReceived = await bReceivesCursor;
  assert(cursorReceived.cursorIndex === 5, 'client B receives client A\'s cursor position');

  // --- Test 6: debounced save actually persists to DB ---
  await new Promise((res) => setTimeout(res, 1300)); // wait past the 1000ms debounce
  const afterSaveRes = await fetch(`${baseUrl}/api/documents/${doc.id}`);
  const afterSave = await afterSaveRes.json();
  assert(afterSave.content === 'Hello from Alice', 'content was persisted to DB after debounce');

  // --- Test 7: disconnect updates presence for remaining user ---
  const bSeesLeave = new Promise((res) => {
    clientB.on('users-updated', (list) => {
      if (!list.some((u) => u.userName === 'Alice')) res(list);
    });
  });
  clientA.disconnect();
  const usersAfterLeave = await bSeesLeave;
  assert(usersAfterLeave.length === 1, 'raw list after Alice leaves contains only Bob himself');

  clientB.disconnect();
  server.close();

  console.log(`\n${failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Integration test crashed:', err);
  process.exit(1);
});
