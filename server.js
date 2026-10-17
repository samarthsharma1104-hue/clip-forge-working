const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { pool, initializeDatabase, createLead, createOrder, getOrder, getOrders, getLeads, orderIdExists } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 8080);
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 250);
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(ROOT));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska',
      'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4'
    ]);
    if (allowed.has(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported media type. Please upload MP4, WebM, MOV, MKV, MP3, or WAV.'));
  }
});

function makeLeadId() {
  return `LEAD-${Math.floor(100000 + Math.random() * 900000)}`;
}
async function makeOrderId() {
  let id;
  do {
    id = `CF-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await orderIdExists(id))) return id;
  } while (true);
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'clip-forge-api', database: 'connected', time: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ ok: false, service: 'clip-forge-api', database: 'unavailable', error: error.message });
  }
});

app.post('/api/leads', async (req, res) => {
  const { name, email, phone = '', url, type = 'Other', style = 'Viral High-Pacing', goal = 'Repurpose Existing Content', volume = '10–15 clips / mo' } = req.body || {};
  if (!name || !email || !url) return res.status(400).json({ error: 'name, email and url are required' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });

  const id = makeLeadId();
  const orderId = await makeOrderId();
  const createdAt = new Date();
  const lead = {
    id, orderId, name, email, phone, url, type, style, goal, volume,
    status: 'received',
    createdAt: createdAt.toISOString()
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await createLead(lead, client);
    await createOrder({
      id: orderId,
      title: `${type} sample request`,
      status: 'Received',
      current: 1,
      steps: ['Request received', 'Content review', 'Hook selection', 'Human editing', 'Quality control', 'Delivered'],
      deliveryDate: 'To be scheduled',
      leadId: id,
      updatedAt: createdAt
    }, client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  res.status(201).json({ ok: true, leadId: id, orderId, message: 'Sample request received.' });
});

app.get('/api/orders/:id', async (req, res) => {
  const id = String(req.params.id || '').trim().toUpperCase();
  const order = await getOrder(id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const progress = Math.round((order.current / order.steps.length) * 100);
  res.json({ ...order, progress });
});

app.post('/api/uploads', upload.single('media'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No media file uploaded.' });
  res.status(201).json({
    ok: true,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
    url: `/uploads/${encodeURIComponent(req.file.filename)}`
  });
});

app.get('/api/leads', async (req, res) => {
  const token = req.get('x-admin-token');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const leads = await getLeads();
  res.json({ count: leads.length, leads });
});

app.get('/api/orders', async (req, res) => {
  const token = req.get('x-admin-token');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const orders = await getOrders();
  res.json({ count: orders.length, orders });
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  if (err) return res.status(400).json({ error: err.message || 'Request failed' });
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
    return res.sendFile(path.join(ROOT, 'index.html'));
  }
  res.status(404).json({ error: 'Not found' });
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Clip Forge running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Unable to initialize PostgreSQL:', error.message);
    process.exit(1);
  });
