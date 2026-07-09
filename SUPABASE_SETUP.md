# Divya Bajaj Supabase Setup

## 1. Create a Supabase project
Create one Supabase project for the Divya Bajaj production system.

## 2. Create the database tables
In Supabase, open SQL Editor and run the full contents of:

`supabase/schema.sql`

This creates:
- leads
- reports
- payments
- bookings
- events

## 3. Copy project credentials
From Supabase project settings, copy:

- Project URL
- Service role key or server secret key

Never expose the service role/server secret key in frontend HTML.

## 4. Add Vercel environment variables
Add these to the Divya Bajaj Vercel project:

`SUPABASE_URL`

Value: your Supabase project URL

`SUPABASE_SERVICE_ROLE_KEY`

Value: your Supabase service role key

You may use `SUPABASE_SECRET_KEY` instead if using a Supabase server secret key.

Apply the variables to Production and Preview.

## 5. Redeploy
Redeploy the latest Vercel deployment after adding the environment variables.

## 6. Verify
Open `/admin` and refresh the dashboard.

The storage badge should say:

`Supabase connected`

Then generate one fresh report from the website. The new lead and report should remain visible in admin even after refreshes and new deployments.

## Safety
Until Supabase credentials are added, the backend automatically uses the old local JSON storage fallback so the live report flow does not break.
