const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');
const pino = require('pino');

const logger = pino({ level: 'info' });
const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json({ limit: '50kb' }));

function getReqId(req) {
  return req.header('X-Request-Id') || crypto.randomUUID();
}

app.use((req, res, next) => {
  const rid = getReqId(req);
  req.requestId = rid;
  res.setHeader('X-Request-Id', rid);
  logger.info({ service: 'checkout-fn', requestId: rid, method: req.method, path: req.path }, 'incoming request');
  next();
});

const PRICING_URL = process.env.PRICING_URL || 'http://pricing-fn:3001';
const INVENTORY_URL = process.env.INVENTORY_URL || 'http://inventory-fn:3002';
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 1500);

const DB_HOST = process.env.DB_HOST || 'postgres-svc';
const DB_PORT = Number(process.env.DB_PORT || 5432);
const DB_NAME = process.env.DB_NAME || 'checkoutdb';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

const pool = new Pool({ host: DB_HOST, port: DB_PORT, database: DB_NAME, user: DB_USER, password: DB_PASSWORD });

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkout_records (
      id SERIAL PRIMARY KEY,
      request_id TEXT NOT NULL,
      sku INTEGER NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL,
      tax NUMERIC(10,2),
      total NUMERIC(10,2),
      in_stock BOOLEAN,
      status TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  logger.info({ service: 'checkout-fn' }, 'checkout_records table ready');
}

async function saveCheckoutRecord(record) {
  await pool.query(
    `INSERT INTO checkout_records (request_id, sku, subtotal, tax, total, in_stock, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [record.requestId, record.sku, record.subtotal, record.tax, record.total, record.inStock, record.status]
  );
}

app.get('/health', async (req, res) => {
  logger.info({ service: 'checkout-fn', requestId: req.requestId }, 'health check');
  res.json({ ok: true, service: 'checkout-fn' });
});

app.post(['/checkout', '/api/checkout'], async (req, res) => {
  const requestId = req.requestId;
  const { sku, subtotal } = req.body;
  const skuNum = Number(sku);
  const subNum = Number(subtotal);

  logger.info({ service: 'checkout-fn', requestId, sku, subtotal }, 'checkout request');

  if (!Number.isInteger(skuNum)) {
    return res.status(400).json({ requestId, error: 'sku must be an integer' });
  }
  if (!Number.isFinite(subNum) || subNum < 0) {
    return res.status(400).json({ requestId, error: 'subtotal must be a non-negative number' });
  }

  const pricingCtl = withTimeout(TIMEOUT_MS);
  const inventoryCtl = withTimeout(TIMEOUT_MS);

  try {
    const [priceRes, stockRes] = await Promise.all([
      fetch(`${PRICING_URL}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
        body: JSON.stringify({ subtotal: subNum }),
        signal: pricingCtl.signal
      }),
      fetch(`${INVENTORY_URL}/stock/${skuNum}`, {
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
        signal: inventoryCtl.signal
      })
    ]);

    if (!priceRes.ok) {
      const body = await priceRes.json().catch(() => ({}));
      logger.warn({ service: 'checkout-fn', requestId }, 'pricing failed');
      return res.status(502).json({ requestId, error: body.error || 'pricing failed' });
    }
    if (!stockRes.ok) {
      const body = await stockRes.json().catch(() => ({}));
      logger.warn({ service: 'checkout-fn', requestId }, 'inventory failed');
      return res.status(502).json({ requestId, error: body.error || 'inventory failed' });
    }

    const price = await priceRes.json();
    const stock = await stockRes.json();

    if (!stock.inStock) {
      await saveCheckoutRecord({ requestId, sku: skuNum, subtotal: subNum, tax: price.tax, total: price.total, inStock: false, status: 'out_of_stock' });
      logger.info({ service: 'checkout-fn', requestId, sku: skuNum }, 'out of stock');
      return res.status(409).json({ requestId, error: 'out of stock', sku: skuNum, price });
    }

    await saveCheckoutRecord({ requestId, sku: skuNum, subtotal: subNum, tax: price.tax, total: price.total, inStock: true, status: 'confirmed' });
    logger.info({ service: 'checkout-fn', requestId, sku: skuNum, status: 'confirmed' }, 'checkout confirmed');
    return res.json({ ok: true, requestId, sku: skuNum, price, stock, status: 'confirmed' });

  } catch (error) {
    logger.error({ service: 'checkout-fn', requestId, err: error.message }, 'dependency timeout/unavailable');
    try {
      await saveCheckoutRecord({ requestId, sku: Number.isInteger(skuNum) ? skuNum : -1, subtotal: Number.isFinite(subNum) ? subNum : 0, tax: null, total: null, inStock: null, status: 'dependency_failed' });
    } catch (dbError) {
      logger.error({ service: 'checkout-fn', requestId }, 'failed to save dependency_failed record');
    }
    return res.status(503).json({ requestId, error: 'dependency timeout/unavailable' });
  } finally {
    pricingCtl.cancel();
    inventoryCtl.cancel();
  }
});

initDb()
  .then(() => app.listen(PORT, () => logger.info({ service: 'checkout-fn', port: PORT }, 'listening')))
  .catch((error) => { logger.error({ service: 'checkout-fn', err: error.message }, 'database initialization failed'); process.exit(1); });
