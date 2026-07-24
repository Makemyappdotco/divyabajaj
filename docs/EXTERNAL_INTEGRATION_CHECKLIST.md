# External Integration Checklist

This checklist separates implementation work from credentials and approvals that must come from Divya Bajaj or MakeMyApp.

## Required now for staging foundation

### Supabase

- Client-owned Supabase organisation and project
- Project URL
- Service role key stored only in Vercel
- Storage bucket for generated reports
- Staging database first, production database later
- Backup and point-in-time recovery decision

### Domain and DNS

- Access to `divyabajaj.com` DNS
- Ability to add email authentication records
- Ability to connect the production Vercel project
- Decision on sending subdomain, recommended `mail.divyabajaj.com`

## Required before payment implementation

### Payment gateway

Final provider approval is required. The current architecture supports a provider adapter so the gateway can be selected later.

If Razorpay is selected, obtain:

- Business/KYC-approved account
- Test key ID and secret
- Production key ID and secret
- Webhook secret
- Refund and settlement access
- Final legal business name shown during checkout

Products to configure:

- Full Blueprint: INR 999
- Private consultation: INR 4,999

## Required before email implementation

Recommended transactional email setup:

- Client-owned provider account
- Verified domain or sending subdomain
- API key
- From name: Divya Bajaj
- From email, recommended `reports@divyabajaj.com`
- Reply-to: `contact@divyabajaj.com`
- SPF, DKIM and DMARC records

Email templates requiring client approval:

- Welcome and free-report delivery
- Full Blueprint payment confirmation
- Full Blueprint delivery
- Consultation confirmation
- Consultation reminders
- Payment failure
- Report generation delay
- Refund confirmation
- Post-report follow-up
- Post-consultation follow-up

## Required before WhatsApp implementation

### Meta assets

- Meta Business Portfolio owned by the client
- Business verification where required
- WhatsApp Business Account
- Approved business phone number
- Meta app with WhatsApp product
- Phone number ID
- WhatsApp Business Account ID
- Long-lived system-user access token or approved production token setup
- App secret
- Webhook verify token
- Webhook callback configured to the production backend

### WhatsApp templates requiring approval

- Free report ready
- Free report delivery
- Full Blueprint payment received
- Full Blueprint ready
- Consultation booking confirmed
- 24-hour appointment reminder
- 2-hour appointment reminder
- Reschedule or cancellation
- Failed payment recovery
- Checkout abandonment recovery
- Report follow-up
- Consultation upsell

Consent copy must be approved for the free-report, paid-report and consultation forms.

## Required before Google Calendar implementation

- Google Cloud project owned by the client
- OAuth consent screen
- OAuth client ID and secret
- Authorised redirect URL
- Divya's Google account authorisation
- Calendar ID to use for availability
- Decision on automatic Google Meet links
- Working days and hours
- Session duration: 60 minutes
- Buffer before and after appointments
- Minimum booking notice
- Maximum advance booking window
- Reschedule and cancellation rules

## Required before paid-report production release

The client must provide or approve:

- Final paid-report section list
- Final calculation list
- Final external API/provider list
- Provider credentials
- Required charts and chart formats
- Required Dasha data
- Required numerology data
- Rules for name, mobile and house-number analysis
- Gemstone and remedy rules
- Restricted claims and disclaimers
- Sample reports considered correct
- Final writing tone
- Final PDF design approval

Until this is received, the current paid-report engine remains preview-only and must not be treated as the final paid product.

## Required before analytics release

- GA4 property and Measurement ID
- Meta Pixel
- Meta Conversions API access token
- Final campaign naming convention
- UTM naming convention
- Consent and privacy policy decision
- Internal dashboard KPI approval

## Client operating information

- Official business/legal name
- Billing address
- GST details, if applicable
- Refund policy
- Privacy policy
- Terms of service
- Astrology and numerology disclaimer
- Consultation cancellation policy
- Support hours
- Escalation contact

## Ownership rule

All production accounts should be created and owned by Divya Bajaj or her business. MakeMyApp should receive administrator or developer access. Production systems should not remain permanently dependent on a MakeMyApp employee's personal account.
