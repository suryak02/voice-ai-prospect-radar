# Roadmap / future improvements

The current build is intentionally scoped as a polished portfolio MVP: deployed, demoable, and realistic enough to discuss engineering tradeoffs, without pretending to be a finished commercial sales platform.

## Shipped in the current build

- Live Google Places search for UK areas and selected verticals.
- Saved all-vertical map browsing for low-cost demos.
- Google Maps UI with ranked markers, filters, and shortlist.
- Explainable 0 to 9 Voice AI fit scoring.
- OpenAI-generated prospect briefs cached in Postgres.
- Admin-only deep research using fetched website text when available.
- Supabase Postgres persistence through Prisma 7.
- Review ticket queue.
- Demo/admin auth tiers.
- Server/browser Google API key split.
- Redis-backed rate limits and short-lived Places search caching when Upstash is configured.
- Vercel production deployment.

## Future product improvements

### 1. Outreach outcome calibration

Use real outreach outcomes to tune the scoring rubric. The current score is explainable and useful for prioritisation, but a commercial version should learn from accepted meetings, replies, and disqualified leads.

### 2. Review text and complaint signals

Where API access and terms allow it, ingest review text to detect missed-call, booking, staff responsiveness, cancellation, and front-desk pain signals more directly.

### 3. CRM and export workflow

Add export or sync into tools like HubSpot, Airtable, or Linear-style review boards so selected prospects can move into an actual sales workflow.

### 4. Public limited demo mode

Create an ungated public mode with strict quotas, disabled deep research, and preloaded demo data so recruiters can explore without credentials while expensive features stay protected.

### 5. Stronger admin research tier

Use a stronger model or multi-source research flow for admin-only briefs, including citations, website service extraction, and confidence notes.

### 6. Analytics and audit logs

Track which prospects are viewed, enriched, opened as tickets, rejected, or exported. This would make the tool more useful for sales teams and easier to evaluate.

### 7. Broader deployment hardening

Move beyond demo auth into real user accounts, workspace isolation, per-user quotas, structured logs, and automated monitoring.
