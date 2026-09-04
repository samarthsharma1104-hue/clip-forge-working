# Clip Forge — Working Full-Stack Website

## Run locally

Requires Node.js 18+.

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
- Order tracker using backend API, with local demo fallback
- 4-step free-sample lead funnel
- Lead creation through `POST /api/leads`
- Media upload API through `POST /api/uploads`
- Health check through `GET /api/health`
- Admin endpoints protected by `ADMIN_TOKEN`
- Local fallback for the lead form when the backend/API is unavailable

## Production note

The site can run locally as provided. For public deployment, use a Node-capable host for the backend and replace the starter JSON storage with a database. Add a real email/CRM connection before relying on the lead form for business enquiries.
