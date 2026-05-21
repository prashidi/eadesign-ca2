const express = require('express');
const crypto = require('crypto');
const pino = require('pino');

const logger = pino({ level: 'info' });
const app = express();
const PORT = process.env.PORT || 3001;
const DELAY_MS = Number(process.env.DELAY_MS || 0);

app.use(express.json({ limit: '50kb' }));

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function getReqId(req) { return req.header('X-Request-Id') || crypto.randomUUID(); }

app.use((req, res, next) => {
  const rid = getReqId(req);
  req.requestId = rid;
  res.setHeader('X-Request-Id', rid);
  logger.info({ service: 'pricing-fn', requestId: rid, method: req.method, path: req.path }, 'incoming request');
  next();
});

app.get('/health', (req, res) => {
  logger.info({ service: 'pricing-fn', requestId: req.requestId }, 'health check');
  res.json({ ok: true, service: 'pricing-fn' });
});

app.post('/price', async (req, res) => {
  const requestId = req.requestId;
  if (DELAY_MS > 0) await sleep(DELAY_MS);
  const { subtotal } = req.body;
  const s = Number(subtotal);
  logger.info({ service: 'pricing-fn', requestId, subtotal }, 'price request');
  if (!Number.isFinite(s) || s < 0) {
    return res.status(400).json({ error: 'subtotal must be a non-negative number' });
  }
  const taxRate = 0.23;
  const tax = Number((s * taxRate).toFixed(2));
  const total = Number((s + tax).toFixed(2));
  logger.info({ service: 'pricing-fn', requestId, subtotal: s, tax, total }, 'price calculated');
  return res.json({ subtotal: s, taxRate, tax, total });
});

app.listen(PORT, () => logger.info({ service: 'pricing-fn', port: PORT }, 'listening'));
