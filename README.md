# Clip Forge — Working Full-Stack Website

## Run locally

Requires Node.js 18+ and PostgreSQL 14+.

Add the database connection to a `.env` file before starting the server:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/clip_forge
```

```bash
npm install
npm start
```

Then open:

`http://localhost:8080`

## What is working

- Responsive Clip Forge website
- Calculator with monthly recording hours AND average video length affecting output
- AI Studio sample selector and caption presets
- Before/after drag slider and video preview
- Portfolio filters and preview modal
- Pricing currency and monthly/quarterly controls
- Content Lab selector
- Client dashboard filters
- Order tracker using the backend API
- 4-step free-sample lead funnel
- Lead creation through `POST /api/leads`
- Media upload API through `POST /api/uploads`
- Health check through `GET /api/health`
- Admin endpoints protected by `ADMIN_TOKEN`
- Leads and orders stored in PostgreSQL

## Production note

The server creates the `leads` and `orders` tables and seeds the demo orders on the first run. For public deployment, use a Node-capable host with a managed PostgreSQL database. Add a real email/CRM connection before relying on the lead form for business enquiries.
