# Report and PDF Contracts

## Purpose

Report generation, PDF design and external calculation APIs must be separate layers.

The system will store a versioned report document as JSON. The website renderer, PDF renderer, email renderer and WhatsApp delivery will consume this document. They must not parse unstructured AI text to guess sections.

## Shared report envelope

Every free or paid report must store:

- report_id
- customer_id
- report_type
- report_contract_version
- calculation_contract_version
- knowledge_version
- prompt_version
- pdf_template_version
- environment: test or production
- language
- generated_at
- source_provider_versions
- input_snapshot
- calculation_snapshot
- sections
- legal_disclaimer
- delivery_metadata

## Free report contract v1

Status: ready for design approval

Recommended length: 5 to 7 pages depending on content.

### Page 1: Cover

- Divya Bajaj branding
- Your Numerology Awareness Report
- Customer name
- Date of birth
- Report reference ID
- Generated date

### Page 2: Your numbers at a glance

- Ruling number
- Destiny number
- Name number where available
- Personal year where available
- Short explanation of what each number represents

### Page 3: Your natural pattern

- Core personality pattern
- Strengths
- Repeated behaviour pattern
- One practical caution

### Page 4: Career and decision energy

- Work style
- Suitable direction
- Current decision pattern
- One practical action

### Page 5: Current phase

- Current numerology cycle
- What deserves attention
- What to avoid
- Short 30-day focus

### Page 6: One remedy and action plan

- Approved remedy
- How to follow it
- Three immediate action steps
- Clear disclaimer

### Final CTA

- Upgrade to the INR 999 Full Blueprint
- Book a private consultation
- WhatsApp and email contact

## Paid Full Blueprint contract

Status: draft only. Not approved for production generation.

The final section list and source APIs will be supplied or approved by the client. The system must allow sections and providers to change without changing payment, customer, PDF-storage or communication tables.

### Proposed modular section groups

1. Cover and client details
2. Executive summary
3. Birth-chart overview
4. Key planetary placements
5. Current Vimshottari Dasha
6. D1 interpretation
7. D9 interpretation
8. D10 interpretation
9. Core numerology numbers
10. Name analysis
11. Mobile-number analysis
12. House-number analysis
13. Career and business
14. Money and financial pattern
15. Relationships and marriage
16. Personal strengths and challenges
17. Timing and priority windows
18. Gemstone or remedy protocol
19. 30-day action plan
20. Consultation recommendation
21. Disclaimer and methodology

Every section must declare:

- section_id
- title
- status: included, unavailable or not_applicable
- source_dependencies
- source_references
- summary
- content_blocks
- recommendations
- warnings
- confidence_notes

## Content block types

Allowed block types:

- paragraph
- key_value_grid
- numbered_list
- bullet_list
- callout
- warning
- chart_image
- data_table
- timeline
- action_plan
- consultation_cta
- disclaimer

The PDF renderer must render only supported block types. Unsupported blocks must fail validation before customer delivery.

## PDF design system

Both PDFs should use the same brand family but different product hierarchy.

### Shared visual language

- Warm ivory and cream content pages
- Near-black cover
- Muted gold accent
- Fraunces-style editorial headings
- Clean sans-serif body text
- Strong page hierarchy
- Page number and report reference
- No loud zodiac, neon or generic cosmic graphics
- Clear spacing and readable typography

### Free PDF

- Lighter and shorter
- Strong summary cards
- Limited charts
- Clear upgrade CTA
- Must still feel complete and useful

### Paid PDF

- Premium cover and divider pages
- Table of contents
- Branded chart pages
- Section navigation
- Data-source notes where required
- Practical action pages
- Consultation conversion section

## Storage rules

- Store the report JSON separately from the generated PDF.
- Store raw provider responses separately from normalised calculation data.
- PDF file names must not be the primary record identity.
- Generated PDFs must have a checksum.
- Regenerated PDFs create a new document version.
- Old document versions remain accessible to authorised admins.
- Customer links should use signed or controlled access rather than public permanent storage URLs.

## Approval gates

Free report cannot be marked production-ready until:

- Content structure approved
- Page design approved
- Mobile PDF readability tested
- Long-name and long-content overflow tested
- PDF download, email and WhatsApp delivery tested

Paid report cannot be marked production-ready until:

- Client-approved API list received
- Client-approved section list received
- Calculation mapping approved
- Report JSON contract frozen for version 1
- PDF design approved
- At least five complete test reports manually reviewed
- Missing-provider and partial-data behaviour approved
