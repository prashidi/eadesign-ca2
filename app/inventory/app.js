const express = require('express');
const crypto = require('crypto');
const pino = require('pino');

const logger = pino({ level: 'info' });
const app = express();
const PORT = process.env.PORT || 3002;
const DELAY_MS = Number(process.env.DELAY_MS || 0);

const inventory = { 1: { inStock: true }, 2: { inStock: true }, 3: { inStock: false } };

function getRequestId(req) { return req.header('X-Request-Id') || crypto.randomUUID(); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

app.use((req, res, next) => {
  const rid = getRequestId(req);
  req.requestId = rid;
  res.setHeader('X-Request-Id', rid);
  logger.info({ service: 'inventory-fn', requestId: rid, method: req.method, path: req.path }, 'incoming request');
  next();
});

app.get('/health', (req, res) => {
  logger.info({ service: 'inventory-fn', requestId: req.requestId }, 'health check');
  res.json({ ok: true, service: 'inventory-fn' });
});

app.get('/stock/:sku', async (req, res) => {
  const requestId = req.requestId;
  if (DELAY_MS > 0) await sleep(DELAY_MS);
  const sku = Number(req.params.sku);
  logger.info({ service: 'inventory-fn', requestId, sku }, 'stock check');
  if (!Number.isInteger(sku)) {
    return res.status(400).json({ error: 'sku must be an integer' });
  }
  const item = inventory[sku];
  if (!item) {
    logger.warn({ service: 'inventory-fn', requestId, sku }, 'unknown sku');
    return res.status(404).json({ error: 'unknown sku' });
  }
  logger.info({ service: 'inventory-fn', requestId, sku, inStock: item.inStock }, 'stock result');
  return res.json({ sku, inStock: item.inStock });
});

app.listen(PORT, () => logger.info({ service: 'inventory-fn', port: PORT }, 'listening'));
