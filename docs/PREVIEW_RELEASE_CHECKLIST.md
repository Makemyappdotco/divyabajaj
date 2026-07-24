# Preview Release Checklist

This checklist records the exact tests required before PR #4 can be considered for a production cutover.

## Completed

- Supabase project connected to the Preview environment
- Permanent lead and report persistence verified
- Paid Preview report generated with AstrologyAPI and OpenAI
- Paid Preview report persisted with complete input, source and report snapshots
- Existing paid test record survived a Vercel redeploy
- Legacy live workbook exported and audited: no leads, reports, payments, bookings or events to migrate
- Direct Full Blueprint route added at `/full-blueprint`
- Direct consultation aliases added
- Customer data list, stats, events and export routes protected by admin authentication
- Unsafe default admin password removed
- Paid report and direct paid PDF endpoints blocked in Production
- Free-report failure lifecycle persists `failed` rather than remaining `generating`
- Free-report PDF links use an expiring HMAC signature
- Backend service-role grants are explicit while browser roles retain no direct CRUD permissions
- Missing foreign-key indexes added
- Supabase security advisor has no warning or error-level findings

## Still requires a browser-accessible Preview URL

Vercel Deployment Protection currently returns the Vercel login page to automated server-side requests. Complete these checks using either a temporary Vercel share link or a Deployment Protection automation-bypass secret:

1. `/health` returns:
   - `storage_mode: supabase`
   - `persistent_storage_ready: true`
   - `foundation_ready: true`
   - `free_report_ready: true`
   - `report_preview_ready: true`
   - `production_ready: false`
2. `/full-blueprint` loads the landing page and automatically opens the paid modal.
3. `/book-consultation?utm_source=preview_test` preserves the query string and lands on `#bookingForm`.
4. An unauthenticated request to `/api/leads` receives `401`.
5. Generate one free report using a unique test identity.
6. Confirm the free report row is `completed` in Supabase.
7. Confirm the returned PDF URL contains `expires` and `token`.
8. Confirm the signed URL downloads a PDF.
9. Confirm the same URL without the token returns `403`.
10. Delete the smoke-test lead, report and events after verification.

## Before Production

- Set a strong Preview and Production `ADMIN_PASSWORD`.
- Set a separately generated `REPORT_DOWNLOAD_SECRET`.
- Keep `SYSTEM_PRODUCTION_READY=false` until the release review is complete.
- Add Production Supabase variables only after all Preview checks pass.
- Do not release the paid engine until the client approves the final paid report contract and provider/API list.
- Do not merge without a final diff review and production rollback plan.
