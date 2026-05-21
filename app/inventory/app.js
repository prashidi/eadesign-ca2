const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3002;
const DELAY_MS = Number(process.env.DELAY_MS || 0);

const inventory = {
  1: { inStock: true },
  2: { inStock: true },
  3: { inStock: false }
};

function getRequestId(req) {
  return req.header('X-Request-Id') || crypto.randomUUID();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.use((req, res, next) => {
  const rid = getRequestId(req);
  req.requestId = rid;
  res.setHeader('X-Request-Id', rid);
  console.log(`[rid=${rid}] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  const requestId = req.requestId;
  console.log(`[inventory-fn] GET /health request_id=${requestId}`);
  res.json({ ok: true, service: 'inventory-fn' });
});

app.get('/stock/:sku', async (req, res) => {
  const requestId = req.requestId;

  if (DELAY_MS > 0) {
    await sleep(DELAY_MS);
  }

  const sku = Number(req.params.sku);
  console.log(`[inventory-fn] GET /stock/${req.params.sku} request_id=${requestId}`);

  if (!Number.isInteger(sku)) {
    return res.status(400).json({ error: 'sku must be an integer' });
  }

  const item = inventory[sku];
  if (!item) {
    return res.status(404).json({ error: 'unknown sku' });
  }

  return res.json({
    sku,
    inStock: item.inStock
  });
});

app.listen(PORT, () => {
  console.log(`inventory-fn listening on port ${PORT}`);
});
