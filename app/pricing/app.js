const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const DELAY_MS = Number(process.env.DELAY_MS || 0);

app.use(express.json({ limit: '50kb' }));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getReqId(req) {
  return req.header('X-Request-Id') || crypto.randomUUID();
}

app.use((req, res, next) => {
  const rid = getReqId(req);
  req.requestId = rid;
  res.setHeader('X-Request-Id', rid);
  console.log(`[rid=${rid}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  const requestId = req.requestId;
  console.log(`[pricing-fn] GET /health request_id=${requestId}`);
  res.json({ ok: true, service: 'pricing-fn' });
});

app.post('/price', async (req, res) => {
  const requestId = req.requestId;

  if (DELAY_MS > 0) {
    await sleep(DELAY_MS);
  }

  const { subtotal } = req.body;
  const s = Number(subtotal);

  console.log(`[pricing-fn] POST /price request_id=${requestId} subtotal=${subtotal}`);

  if (!Number.isFinite(s) || s < 0) {
    return res.status(400).json({ error: 'subtotal must be a non-negative number' });
  }

  const taxRate = 0.23;
  const tax = Number((s * taxRate).toFixed(2));
  const total = Number((s + tax).toFixed(2));

  return res.json({
    subtotal: s,
    taxRate,
    tax,
    total
  });
});

app.listen(PORT, () => {
  console.log(`pricing-fn listening on port ${PORT}`);
});
