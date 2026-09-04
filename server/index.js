// Minimal mock backend so you can test the full offline -> online sync flow
// without standing up a real server. Not for production use.
//
// Run:   npm run mock-server
// Then:  vite.config.ts already proxies /api -> this server in dev (see
//        server.proxy below) — or just point API_ENDPOINT in src/lib/sync.ts
//        at http://localhost:4000/api/inspections directly.
import express from 'express';

const app = express();
app.use(express.json({ limit: '10mb' }));

/** @type {Map<string, any>} keyed by record id -> idempotent upsert */
const store = new Map();

app.post('/api/inspections', (req, res) => {
  const record = req.body;
  if (!record?.id) {
    return res.status(400).json({ error: 'Missing id' });
  }

  // Simulate an occasional flaky connection so you can see PENDING_SYNC /
  // SYNC_ERROR states in the UI during testing. Remove for a "always
  // succeeds" mock.
  if (Math.random() < 0.1) {
    return res.status(503).json({ error: 'Simulated network blip, retry' });
  }

  store.set(record.id, { ...record, receivedAt: Date.now() });
  console.log(`[mock-server] upserted ${record.id} (${store.size} total)`);
  res.status(200).json({ ok: true, id: record.id });
});

app.get('/api/inspections', (_req, res) => {
  res.json(Array.from(store.values()));
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Mock backend listening on http://localhost:${PORT}`);
});
