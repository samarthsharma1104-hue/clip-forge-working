const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 8080);
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 250);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

if (!fs.existsSync(LEADS_FILE)) writeJson(LEADS_FILE, []);
if (!fs.existsSync(ORDERS_FILE)) {
  writeJson(ORDERS_FILE, [
    {
      id: 'CF-8942',
      title: 'Podcast Episode 27',
      status: 'In Review',
      current: 4,
      steps: ['Source received', 'Hook analysis', 'Vertical framing', 'Captions + sound design', 'Human QC'],
      deliveryDate: 'Demo delivery window',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'CF-7710',
      title: 'Founder Interview Batch',
      status: 'Approved',
      current: 5,
      steps: ['Source received', 'Hook analysis', 'Vertical framing', 'Captions + sound design', 'Delivered'],
      deliveryDate: 'Ready',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'CF-5521',
      title: 'Fitness Reels Batch',
      status: 'Processing',
      current: 3,
      steps: ['Source received', 'Hook analysis', 'Vertical framing', 'Captions + sound design', 'Human QC'],
      deliveryDate: 'Demo delivery window',
      updatedAt: new Date().toISOString()
    }
  ]);
}

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
function makeOrderId() {
  let orders = readJson(ORDERS_FILE, []);
  let id;
  do id = `CF-${Math.floor(1000 + Math.random() * 9000)}`; while (orders.some(o => o.id === id));
  return id;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'clip-forge-api', time: new Date().toISOString() });
});

app.post('/api/leads', (req, res) => {
  const { name, email, phone = '', url, type = 'Other', style = 'Viral High-Pacing', goal = 'Repurpose Existing Content', volume = '10–15 clips / mo' } = req.body || {};
  if (!name || !email || !url) return res.status(400).json({ error: 'name, email and url are required' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });

  const leads = readJson(LEADS_FILE, []);
  const id = makeLeadId();
  const orderId = makeOrderId();
  const lead = {
    id, orderId, name, email, phone, url, type, style, goal, volume,
    status: 'received',
    createdAt: new Date().toISOString()
  };
  leads.unshift(lead);
  writeJson(LEADS_FILE, leads);

  const orders = readJson(ORDERS_FILE, []);
  orders.unshift({
    id: orderId,
    title: `${type} sample request`,
    status: 'Received',
    current: 1,
    steps: ['Request received', 'Content review', 'Hook selection', 'Human editing', 'Quality control', 'Delivered'],
    deliveryDate: 'To be scheduled',
    leadId: id,
    updatedAt: lead.createdAt
  });
  writeJson(ORDERS_FILE, orders);

  res.status(201).json({ ok: true, leadId: id, orderId, message: 'Sample request received.' });
});

app.get('/api/orders/:id', (req, res) => {
  const id = String(req.params.id || '').trim().toUpperCase();
  const orders = readJson(ORDERS_FILE, []);
  const order = orders.find(o => o.id === id);
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

app.get('/api/leads', (req, res) => {
  const token = req.get('x-admin-token');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const leads = readJson(LEADS_FILE, []);
  res.json({ count: leads.length, leads });
});

app.get('/api/orders', (req, res) => {
  const token = req.get('x-admin-token');
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const orders = readJson(ORDERS_FILE, []);
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

app.listen(PORT, () => {
  console.log(`Clip Forge running at http://localhost:${PORT}`);
});
