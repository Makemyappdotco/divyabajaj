# Divya Bajaj Production System Implementation

## Status

This document is the approved implementation baseline for converting the current website and report preview into a production-ready client handover system.

The current paid report remains a review version. Its report structure, calculations and external APIs may change after client clarification. Therefore, the paid-report content contract must remain versioned and replaceable without changing payments, customer records, delivery, analytics or appointment systems.

## Canonical public links

- Landing page: `/`
- Free report entry: `/free-report`
- Full Blueprint entry: `/full-blueprint`
- Private consultation page: `/consultation`
- Direct private consultation booking link: `/book-consultation`

`/book-consultation` must take the visitor directly to the consultation booking form. It must preserve UTM query parameters so attribution remains available.

The current consultation price is INR 4,999 for 60 minutes. INR 499 is not the current approved project price.

## Immediate production risks found in the current code

1. When Supabase is unavailable, the backend writes to JSON files under `/tmp` on Vercel.
2. `/tmp` is temporary runtime storage. Deployments, instance changes and restarts can remove the data.
3. Paid-report persistence is currently best-effort. A persistence error can be logged and the frontend can still show success.
4. The current admin area is only a shallow statistics and export page.
5. Admin authentication uses Basic Auth and contains unsafe default fallback credentials.
6. Consultation booking currently redirects to WhatsApp. It does not create a booking, hold a slot, collect payment or sync a calendar.
7. PDF generation is coupled to the current report text instead of a stable versioned report document contract.
8. Free and paid reports do not have independently approved final design specifications.
9. Payments, communications and webhooks do not yet have idempotent production flows.
10. Analytics events and campaign attribution are not consistently stored across the complete funnel.

## Implementation rules

1. Live `main` must remain stable while production foundation work happens on a separate branch.
2. Production customer writes must fail clearly if permanent storage is unavailable. They must never silently fall back to temporary storage.
3. External integrations must be isolated behind provider adapters.
4. Payment success must be confirmed server-side by a verified gateway webhook.
5. Report generation must run as a recoverable job after payment confirmation.
6. Email, WhatsApp and PDF delivery failures must not delete or invalidate a successfully generated report.
7. Every report must record its data-source version, prompt version, knowledge version, report contract version and PDF-template version.
8. Test and production records must be separated.
9. Personally identifiable information must not be sent to GA4 or Meta Pixel.
10. Every critical action must create an audit or operational event.

## Phase 1: Foundation and audit

Deliverables:

- Direct consultation booking route
- Permanent-storage production guard
- Versioned database migration
- Free-report PDF contract
- Draft paid-report contract
- External account and credential checklist
- CTA and route inventory
- Analytics event dictionary
- Admin dashboard information architecture
- Acceptance-test matrix

Exit condition:

No production write can silently use temporary storage, and all future modules have an agreed data contract.

## Phase 2: Permanent data layer

Implement:

- Customer identity and deduplication
- Customer contact and consent history
- Visitor sessions and attribution touchpoints
- Report requests, report versions and generated documents
- Orders, payment attempts, payments, refunds and webhook events
- Availability, slot holds, appointments and calendar sync events
- Email and WhatsApp message history
- Background jobs and retry state
- Knowledge-base versions and prompt versions
- Audit logs, settings and admin roles

Migration approach:

- Preserve existing `leads`, `reports`, `payments`, `bookings` and `events` data.
- Add production tables alongside them.
- Build controlled migration scripts from legacy records.
- Do not delete legacy records until reconciliation is signed off.

## Phase 3: Report platform

### Free report

- Stable free-report input contract
- Permanent request and result records
- Versioned report JSON
- Approved PDF template
- Secure PDF storage
- Email and WhatsApp delivery jobs
- Resend and regenerate controls

### Paid Full Blueprint

- Keep current engine in preview mode
- Wait for client-approved sections and calculation/API list
- Convert the approved structure into a versioned report contract
- Add provider adapters for every approved calculation API
- Store raw provider responses and normalised calculation data separately
- Generate the customer-facing report only from the normalised contract
- Generate PDF only from the final report document JSON

This separation allows the client to change APIs or report sections without rebuilding customer, payment or communication systems.

## Phase 4: Payments

Products:

- Full Blueprint: INR 999
- Private consultation: INR 4,999

Required flow:

1. Create draft order and customer record.
2. Create gateway order server-side.
3. Open checkout.
4. Verify browser callback signature.
5. Verify gateway webhook.
6. Mark payment captured idempotently.
7. Start the related report or appointment workflow once.
8. Handle failure, abandonment, refund and webhook replay.

No paid report or confirmed appointment may be delivered based only on frontend checkout success.

## Phase 5: Consultation booking

Required capabilities:

- Direct booking URL
- Availability rules
- Blocked dates and manual blocks
- Google Calendar free/busy check
- Temporary slot hold during payment
- Unique active booking per slot
- INR 4,999 payment
- Confirmed appointment record
- Google Calendar event and optional Meet link
- Email and WhatsApp confirmation
- Reminder workflow
- Reschedule and cancellation workflow
- Admin calendar and availability controls

## Phase 6: Email and WhatsApp

Email:

- Verified sending domain
- Branded responsive templates
- Delivery, bounce and complaint events
- Secure report links
- Customer communication preferences

WhatsApp:

- Meta Business account and WhatsApp Business Account
- Approved templates
- Delivery and failure webhooks
- Free-report, paid-report, appointment and recovery sequences
- Opt-in and opt-out records

## Phase 7: Analytics

First-party analytics remains the source of truth for funnel operations.

Required events include:

- page_view
- cta_click
- whatsapp_click
- free_report_open
- free_report_submit
- free_report_complete
- free_pdf_download
- paid_report_open
- paid_report_submit
- checkout_start
- payment_success
- payment_failure
- paid_report_complete
- consultation_open
- slot_select
- consultation_checkout_start
- appointment_confirmed

Every event should support session ID, anonymous visitor ID, customer ID when known, CTA ID, route, UTM values, referrer, device class and timestamp.

## Phase 8: Admin and handover

Admin modules:

- Overview
- Customers
- Reports
- Payments
- Appointments
- Calendar availability
- Email and WhatsApp
- Jobs and failures
- Analytics
- Knowledge and report versions
- Settings
- Audit log

Handover requires:

- Client-owned integration accounts
- Admin operating manual
- Recorded walkthrough
- Refund, booking and report SOPs
- Backup and restore test
- Monitoring and incident guide
- Credential transfer checklist
- Acceptance-test sign-off

## Implementation order from this point

1. Merge the direct consultation link and storage safety guard after review.
2. Apply the production database migration to a staging Supabase project.
3. Connect staging environment variables.
4. Migrate and reconcile current test data.
5. Implement customer, report request and report version repositories.
6. Build the free-report contract and final free PDF first.
7. Build payment-provider adapter and test-mode order flow.
8. Build appointment availability and slot-hold engine.
9. Connect Google Calendar in staging.
10. Connect email and WhatsApp providers after credentials are supplied.
11. Finalise the paid-report contract when the client supplies approved APIs and report structure.
12. Build admin modules and complete end-to-end QA.
