# Roadmap / future improvements

The current build is intentionally scoped as a polished portfolio MVP: deployed, demoable, and realistic enough to discuss engineering tradeoffs, without pretending to be a finished commercial sales platform.

## Shipped in the current build

- Live Google Places search for UK areas and selected verticals.
- Live Google Places pagination up to three pages per selected vertical, with Google Place ID dedupe before mapping.
- Saved all-vertical map browsing for low-cost demos.
- Leaflet/CARTO map UI with canvas-backed vector markers, filters, and shortlist.
- Explainable 0 to 9 Voice AI fit scoring.
- OpenAI-generated prospect briefs cached in Postgres.
- Admin-only deep research using fetched website text when available.
- Supabase Postgres persistence through Prisma 7.
- Review ticket queue.
- Demo/admin auth tiers.
- Server-side Google Places key only; no browser Google Maps key is required.
- Redis-backed rate limits and short-lived Places search caching when Upstash is configured.
- Vercel production deployment.

## Future product improvements

### 1. Outreach outcome calibration

Use real outreach outcomes to tune the scoring rubric. The current score is explainable and useful for prioritisation, but a commercial version should learn from accepted meetings, replies, and disqualified leads.

### 2. Review text and complaint signals

Where API access and terms allow it, ingest review text to detect missed-call, booking, staff responsiveness, cancellation, and front-desk pain signals more directly.

### 3. CRM and export workflow

Add export or sync into tools like HubSpot, Airtable, or Linear-style review boards so selected prospects can move into an actual sales workflow.

### 4. Postcode-aware territory search

Support full UK postcodes and outward postcode fragments such as `NW1` by normalising them to a centre/bounds before querying Google Places. The current live search paginates each selected vertical, but still relies on one text query per vertical, which can under-sample dense trades markets.

### 5. Larger saved prospect database

Build an admin/offline Google Places ingestion flow that tiles by borough/outward postcode/category, dedupes by Google Place ID, and stores compact rows. Keep the saved dataset comfortably below the Supabase Free database-size quota; the working owner target is about 40% of the free tier.

### 6. Public limited demo mode

Create an ungated public mode with strict quotas, disabled deep research, and preloaded demo data so recruiters can explore without credentials while expensive features stay protected.

### 7. Stronger admin research tier

Use a stronger model or multi-source research flow for admin-only briefs, including citations, website service extraction, and confidence notes.

### 8. Analytics and audit logs

Track which prospects are viewed, enriched, opened as tickets, rejected, or exported. This would make the tool more useful for sales teams and easier to evaluate.

### 9. Broader deployment hardening

Move beyond demo auth into real user accounts, workspace isolation, per-user quotas, structured logs, and automated monitoring.
