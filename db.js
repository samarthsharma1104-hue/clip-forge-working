const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEMO_ORDERS = [
  {
    id: 'CF-8942',
    title: 'Podcast Episode 27',
    status: 'In Review',
    current: 4,
    steps: ['Source received', 'Hook analysis', 'Vertical framing', 'Captions + sound design', 'Human QC'],
    deliveryDate: 'Demo delivery window',
    updatedAt: '2026-09-03T12:00:00.000Z'
  },
  {
    id: 'CF-7710',
    title: 'Founder Interview Batch',
    status: 'Approved',
    current: 5,
    steps: ['Source received', 'Hook analysis', 'Vertical framing', 'Captions + sound design', 'Delivered'],
    deliveryDate: 'Ready',
    updatedAt: '2026-09-03T12:00:00.000Z'
  },
  {
    id: 'CF-5521',
    title: 'Fitness Reels Batch',
    status: 'Processing',
    current: 3,
    steps: ['Source received', 'Hook analysis', 'Vertical framing', 'Captions + sound design', 'Human QC'],
    deliveryDate: 'Demo delivery window',
    updatedAt: '2026-09-03T12:00:00.000Z'
  }
];

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      type TEXT NOT NULL,
      style TEXT NOT NULL,
      goal TEXT NOT NULL,
      volume TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      current_step INTEGER NOT NULL,
      steps JSONB NOT NULL,
      delivery_date TEXT NOT NULL,
      lead_id TEXT REFERENCES leads(id),
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS data_migrations (
      name TEXT PRIMARY KEY,
      completed_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS leads_order_id_unique_idx ON leads (order_id);
    CREATE INDEX IF NOT EXISTS orders_updated_at_idx ON orders (updated_at DESC);
    CREATE INDEX IF NOT EXISTS orders_lead_id_idx ON orders (lead_id);
  `);

  const migration = await pool.query('SELECT 1 FROM data_migrations WHERE name = $1', ['json-data-v1']);
  if (migration.rowCount === 0) {
    await migrateJsonFile('leads.json', migrateLead);
    await migrateJsonFile('orders.json', migrateOrder);
    await pool.query(
      'INSERT INTO data_migrations (name, completed_at) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      ['json-data-v1', new Date()]
    );
  }

  for (const order of DEMO_ORDERS) {
    await createOrder(order);
  }
}

async function migrateJsonFile(fileName, mapper) {
  let records;
  try {
    records = JSON.parse(await fs.readFile(path.join(DATA_DIR, fileName), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  if (!Array.isArray(records)) return;
  for (const record of records) {
    await mapper(record);
  }
}

async function migrateLead(lead) {
  await pool.query(
    `INSERT INTO leads (id, order_id, name, email, phone, url, type, style, goal, volume, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO NOTHING`,
    [lead.id, lead.orderId, lead.name, lead.email, lead.phone || '', lead.url, lead.type, lead.style, lead.goal, lead.volume, lead.status, lead.createdAt]
  );
}

async function migrateOrder(order) {
  await createOrder(order);
}

async function createLead(lead, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO leads (id, order_id, name, email, phone, url, type, style, goal, volume, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, order_id AS "orderId", name, email, phone, url, type, style, goal, volume,
               status, created_at AS "createdAt"`,
    [lead.id, lead.orderId, lead.name, lead.email, lead.phone, lead.url, lead.type, lead.style, lead.goal, lead.volume, lead.status, lead.createdAt]
  );
  return rows[0];
}

async function createOrder(order, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO orders (id, title, status, current_step, steps, delivery_date, lead_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING
     RETURNING id, title, status, current_step AS current, steps, delivery_date AS "deliveryDate",
               lead_id AS "leadId", updated_at AS "updatedAt"`,
    [order.id, order.title, order.status, order.current, JSON.stringify(order.steps), order.deliveryDate, order.leadId || null, order.updatedAt]
  );
  return rows[0];
}

async function getOrder(id) {
  const { rows } = await pool.query(
    `SELECT id, title, status, current_step AS current, steps, delivery_date AS "deliveryDate",
            lead_id AS "leadId", updated_at AS "updatedAt"
     FROM orders WHERE id = $1`,
    [id]
  );
  return rows[0];
}

async function getOrders() {
  const { rows } = await pool.query(
    `SELECT id, title, status, current_step AS current, steps, delivery_date AS "deliveryDate",
            lead_id AS "leadId", updated_at AS "updatedAt"
     FROM orders ORDER BY updated_at DESC`
  );
  return rows;
}

async function getLeads() {
  const { rows } = await pool.query(
    `SELECT id, order_id AS "orderId", name, email, phone, url, type, style, goal, volume,
            status, created_at AS "createdAt"
     FROM leads ORDER BY created_at DESC`
  );
  return rows;
}

async function orderIdExists(id) {
  const { rowCount } = await pool.query('SELECT 1 FROM orders WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { pool, initializeDatabase, createLead, createOrder, getOrder, getOrders, getLeads, orderIdExists };
