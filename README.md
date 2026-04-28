# Divya Bajaj - Backend System

Complete backend for the Divya Bajaj Astro-Numerologist platform.

## Architecture

```
Landing Page Form
      |
      v
   /api/reports/free  --> Numerology Calculator --> Claude AI Agent --> Report
      |                                                                    |
      v                                                                    v
   Lead Created                                                   On-Screen Display
      |                                                                    |
      v                                                                    v
   WhatsApp Delivery --> Follow-up Bot (2hr delay) --> Upsell --> Payment
```

## API Endpoints

### Public (no auth needed)
- `POST /api/leads` - Capture lead from landing page
- `POST /api/reports/free` - Generate free report (full pipeline)
- `POST /api/payments/webhook` - Razorpay webhook
- `POST /api/calculate` - Standalone numerology calculator

### Protected (admin auth)
- `GET /api/leads` - List leads (filter by status, tier, search)
- `GET /api/leads/:id` - Lead detail with reports, payments, bookings
- `PATCH /api/leads/:id` - Update lead
- `POST /api/reports/paid` - Create paid report + Razorpay order
- `POST /api/payments/verify` - Verify Razorpay payment
- `GET /api/payments` - List payments
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - List bookings
- `GET /api/bookings/slots/:date` - Available slots for a date
- `GET /api/stats` - Dashboard analytics
- `GET /api/events` - Activity log
- `GET /api/export/:table?format=csv` - Export CSV

## Setup

1. `cp .env.example .env` and fill in your keys
2. `npm install`
3. `npm start`

Server runs on port 3000.
- API: http://localhost:3000/api
- Admin Dashboard: http://localhost:3000/admin

## Services

### Numerology Calculator (`services/numerology.js`)
Pure math calculations - no API needed:
- Ruling Number (from DOB day)
- Destiny Number (from full DOB)
- Name Number (Chaldean method)
- Lo Shu Grid (digit frequency)
- Personal Year
- Plane Analysis (Mental/Emotional/Practical)

### AI Report Agent (`services/numerology.js`)
Uses Claude API to generate human-readable reports from calculated numbers.
Two modes: Free (500 words) and Paid (2000-3000 words).

### Razorpay (`services/razorpay.js`)
Order creation, signature verification, refunds.
Works in mock mode if keys not configured.

### WhatsApp (`services/whatsapp.js`)
Report delivery, payment confirmations, booking confirmations, follow-up upsells.
Compatible with Interakt/AiSensy/Wati APIs.

## Data Storage
JSON files in `/data` directory. Production recommendation: migrate to PostgreSQL or MongoDB.

## Deployment

### Vercel test deployment
This repo includes `api/index.js` and `vercel.json`, so it can be imported into Vercel for testing.

Important: the current JSON database writes to `/tmp` on Vercel. This is fine for demo/testing, but data is not permanent. For production, migrate the database layer to Supabase, PostgreSQL, MongoDB, or another persistent database.

### Recommended production hosting
Railway, Render, or DigitalOcean App Platform are better for this exact Express + JSON storage version because they can keep a persistent disk.
