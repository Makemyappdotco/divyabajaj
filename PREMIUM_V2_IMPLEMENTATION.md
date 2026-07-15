# Divya Bajaj Premium Report V2

This branch contains the isolated premium 14-page report engine. It does not replace the current live paid report flow.

## Implemented on this branch

- deterministic fact ledger using existing numerology calculations
- verified/unverified astrology claim boundary
- master interpretation structured JSON
- fixed 14-page page-content JSON schema
- anti-AI language rules and no-em-dash rule
- hard per-field word limits
- number consistency validation
- repetition scanning
- controlled short / standard / dense layout planning metadata
- fixed 14-page SVG renderer based on the approved report benchmark
- A4 page geometry and footer safety checks
- PNG preview rendering
- AI visual QA with structured issue output
- constrained page-level automatic correction
- vector PDF composition
- staged background job worker
- durable job state using the existing leads and reports tables
- private Supabase Storage for page previews and final PDF
- public job creation and status endpoints on the isolated branch
- build-time module graph smoke test

## Not connected to the live purchase flow

The current production Get Blueprint flow remains unchanged on main.

The v2 flow must pass an end-to-end branch test before any live switch.
