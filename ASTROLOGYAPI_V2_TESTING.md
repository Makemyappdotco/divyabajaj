# AstrologyAPI Full Blueprint V2 Preview

This branch is isolated from production.

## Preview environment variables

- `ASTROLOGYAPI_V2_ACCESS_TOKEN`
- `ASTROLOGYAPI_PDF_SANDBOX_TOKEN`
- `ASTROLOGYAPI_MODE=sandbox`
- Existing `OPENAI_API_KEY`
- Existing `OPENAI_PAID_MODEL`

## Preview-only endpoints

- `GET /api/astrology-v2/status`
- `GET /api/locations/search?q=Delhi`
- `POST /api/locations/timezone`
- `POST /api/astrology-v2/source-test`
- `POST /api/reports/paid-test-v2`

## Safety

The old paid-report route and existing production AstrologyAPI variable remain untouched. The V2 routes are intended for Vercel Preview testing before any production merge.

## Redeploy note

Preview redeployed after the sandbox PDF environment variable was added so the latest deployment can read the current Preview configuration.

A second clean Preview deployment was triggered after the sandbox PDF token was recreated with the exact variable name and Preview scope.
