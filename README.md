# Voice AI Prospect Map

A deployed prospect-intelligence map that helps Voice AI companies prioritise local businesses likely to benefit from AI call handling, appointment booking, reminders, and customer-service automation.

Live demo: https://voice-ai-prospect-map.vercel.app  
Access is gated. Credentials are available on request.

![Voice AI Prospect Map demo](docs/demo.gif)

## Why I built this

Voice AI vendors do not just need a list of local businesses. They need to know which businesses are most likely to have missed-call, booking, receptionist, or customer-service pain, and which ones are worth human outreach first.

This project turns that go-to-market problem into a working AI workflow: search a territory, score local businesses, map the opportunity, generate a prospect brief, and save follow-up decisions.

## What it does

- Searches real UK businesses through Google Places.
- Scores each business from 0 to 9 for Voice AI fit.
- Shows ranked prospects on a Google Map with shortlist and filters.
- Explains the score with visible public-signal breakdowns.
- Generates an OpenAI-written prospect brief and outreach angle on demand.
- Supports admin-only deep research that attempts to fetch the business website and uses extracted page text when available for a more grounded brief.
- Saves review decisions in a ticket-style queue.
- Defaults to an all-vertical saved map so demos can browse the full territory without spending live API calls.

## What this demonstrates

- Turning a vague GTM idea into a deployed AI product workflow.
- Integrating Google Places, Google Maps, OpenAI, Supabase/Postgres, Prisma, Upstash Redis, and Vercel.
- Designing explainable scoring rather than opaque AI ranking.
- Building cost-aware LLM enrichment with caching, cooldowns, rate limits, and access tiers.
- Handling a realistic public/private repo split for a gated demo without exposing internal notes or secrets.
- Shipping a stakeholder-friendly interface, not just a backend script or chatbot.

## Demo flow

1. Open the saved all-vertical prospect map.
2. Select a high-scoring business and inspect the score breakdown.
3. Generate an AI prospect brief and outreach angle.
4. Run a targeted live search for a UK area and selected verticals.
5. Filter the current result set by vertical and minimum score.
6. Open or reject review tickets for follow-up.

## Architecture

```text
User / reviewer
  ↓
Next.js 16 App Router UI
  ↓
API routes
  ├─ /api/businesses       saved prospect map
  ├─ /api/prospect-search  live Google Places search
  ├─ /api/enrich           OpenAI prospect briefs
  ├─ /api/tickets          review queue
  └─ /api/me               admin/demo tier
  ↓
Supabase Postgres via Prisma 7
  ├─ businesses
  └─ tickets
  ↓
External services
  ├─ Google Places API
  ├─ Google Maps JavaScript API
  ├─ OpenAI API
  └─ Upstash Redis for shared cache/rate limits
```

The app uses deterministic scoring for the ranking and reserves LLM calls for explanatory prospect briefs. That keeps the ranking inspectable and the AI spend controlled.

## Scoring model

The 0 to 9 score is based on public signals such as:

- category fit for Voice AI use cases
- call dependency
- appointment or scheduling complexity
- website and online-booking friction
- review volume as a demand proxy
- public rating and review-volume friction proxies
- confidence penalties for missing public data

The score is intentionally explainable. The UI shows why a prospect ranked highly instead of asking the user to trust a black-box AI score.

## AI enrichment

OpenAI is used on demand to generate:

- a short prospect summary
- the likely operational pain
- a practical outreach angle
- optional admin-only deep research using fetched website text when available

AI output is saved in Postgres and reused with a cooldown so repeated demo clicks do not burn tokens.

## Cost and abuse controls

- Gated demo with admin and demo tiers.
- Demo users cannot access deep research.
- Redis-backed rate limits for expensive endpoints when Upstash is configured.
- Short-lived Google Places search cache.
- Postgres cache for AI enrichment output.
- Low-cost OpenAI model by default.
- Server/browser split for Google API keys.

## Tech stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Prisma 7 with Supabase Postgres
- Google Places API and Google Maps JavaScript API
- OpenAI API
- Upstash Redis
- Vercel

## Local setup

```bash
npm install
cp .env.example .env.local
# Fill .env.local with Supabase/Postgres, Google Maps/Places, and OpenAI keys
npm run db:push
npm run db:seed
npm run dev
```

For a reviewer who only wants to inspect the product, use the deployed gated demo. Local setup requires your own provider keys and may incur Google/OpenAI usage costs.

Fill `.env.local` with your own provider keys. Real credentials should stay in Vercel environment variables and local `.env.local`, never in committed docs.

Useful checks:

```bash
npm run lint
npm test
npm run build
```

If you change the scoring rubric, rescore stored businesses:

```bash
npm run db:rescore
```

## Environment variables

See `.env.example` for the full list. The important split is:

- server-only: database URL, OpenAI key, Google Places key, Redis token, and gate passwords
- browser-safe: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, restricted by HTTP referrer in Google Cloud

Only variables prefixed with `NEXT_PUBLIC_` are bundled into browser code.

## Roadmap

See [`ROADMAP.md`](ROADMAP.md) for future improvements. The current build is intentionally scoped as a portfolio MVP: strong enough to demo the workflow, but not pretending to be a finished commercial product.

## Case study

See [`CASE_STUDY.md`](CASE_STUDY.md) for the product framing, architecture decisions, tradeoffs, and resume-safe project summary.
