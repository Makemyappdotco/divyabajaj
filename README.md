# Divya Bajaj Backend System

Backend for the Divya Bajaj astrology and numerology funnel.

## What this system does

```text
Landing page form
      |
      v
/api/reports/free
      |
      v
Lead created -> Numerology calculation -> OpenAI report generation -> Report saved
      |
      v
WhatsApp delivery in mock mode now, provider API can be added later
      |
      v
Upsell follow-up for paid report and consultation
```

## Current status

This version is prepared for Vercel testing and uses OpenAI instead of Claude.

Working now:
- Express API
- Admin dashboard
- Basic auth for admin and protected APIs
- Numerology calculation without external API
- Free report pipeline
- OpenAI report generation when `OPENAI_API_KEY` is added
- Razorpay mock mode when keys are missing
- WhatsApp mock mode when provider keys are missing
- JSON file database for testing

Important: On Vercel, JSON storage is temporary. This is okay for testing. For production, move the database to Supabase, PostgreSQL, MongoDB, or another persistent database.

## Required Vercel environment variables

Minimum for testing:

```env
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-this-now
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
```

Optional for later:

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
WHATSAPP_API_KEY=
WHATSAPP_API_URL=
SITE_URL=
```

## API endpoints

### Public endpoints

- `POST /api/leads`
- `POST /api/reports/free`
- `POST /api/payments/webhook`
- `POST /api/calculate`
- `GET /health`

### Protected admin endpoints

These require Basic Auth using `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

- `GET /api/leads`
- `GET /api/leads/:id`
- `PATCH /api/leads/:id`
- `POST /api/reports/paid`
- `POST /api/payments/verify`
- `GET /api/payments`
- `POST /api/bookings`
- `GET /api/bookings`
- `GET /api/bookings/slots/:date`
- `GET /api/stats`
- `GET /api/events`
- `GET /api/export/:table?format=csv`

## Admin dashboard

Open:

```text
/admin
```

Browser will ask for username and password.

## Local setup

```bash
npm install
npm start
```

Server runs on port 3000.

```text
API: http://localhost:3000/api
Admin: http://localhost:3000/admin
Health: http://localhost:3000/health
```

## Vercel setup

Settings:

```text
Application Preset: Other
Root Directory: ./
Build Command: npm run build
Install Command: npm install
Output Directory: leave blank
```

Then add environment variables and deploy.

## Production recommendation

Before client launch:

1. Move JSON storage to Supabase or PostgreSQL.
2. Add real WhatsApp provider integration.
3. Add Razorpay live keys.
4. Add FreeAstrologyAPI as optional astrology calculation layer.
5. Add report review/edit flow for Divya before paid report delivery.
