# Voice AI Prospect Map

> A geospatial **prospect-intelligence** web app that scores UK local businesses for
> "Voice AI fit," ranks them on an interactive map, and generates AI-written,
> website-grounded prospect briefs.

**Live demo:** https://voice-ai-prospect-map.vercel.app — *access-gated; credentials available on request.*

![Voice AI Prospect Map — demo](docs/demo.gif)

Built with **Next.js 16 · React 19 · TypeScript · Tailwind v4 · Prisma + Supabase Postgres · Google Places/Maps · OpenAI · Upstash Redis**, deployed on Vercel.

---

## What it is

A tool for a Voice AI company (which sells an AI phone receptionist) to decide **which
local businesses to call first**. It pulls real businesses from the Google Places API,
scores each **0–9 for "AI receptionist fit"** using transparent public signals, plots and
ranks them on a map, and layers on an AI analyst that writes a personalized pitch for any
prospect — including an admin-only "deep research" mode that reads the business's website.

## Features

- **UK-wide live search** (Google Places API, New) across **24 verticals**, up to 6 at once.
- **Explainable 0–9 fit score** per business, with a component breakdown (no black box).
- **Interactive map** that auto-fits to results, with score-colored, viewport-culled markers.
- **AI prospect analysis** (OpenAI): a personalized summary + outreach angle, cached in the
  database with a 7-day cooldown to control cost.
- **Admin-only deep web research**: fetches and reads the business's website for a
  source-grounded brief.
- **Two-tier access control** (admin / demo) enforced at the edge.
- **Light / dark theme**, ranked shortlist, category + score filters, and a review/ticket workflow.

## Engineering highlights

- **Explainable scoring** — a deterministic 0–9 rubric (`src/lib/scoring.ts`) computed from
  public signals; tunable and re-runnable across the dataset (`npm run db:rescore`).
- **Cost-controlled AI** — OpenAI enrichment is cached in Postgres with a weekly cooldown,
  and the expensive deep-research tier is gated to admin so general viewers can't run up spend.
- **Redis-backed protection** — Upstash powers shared rate limits and a short-lived Google
  Places search cache to reduce repeated API calls across Vercel serverless instances.
- **Performance** — parallelized external API calls, viewport-culled map markers, memoized rendering.
- **Security** — edge-proxy auth with two tiers, and a **split Google API key** setup (a
  server key that's never exposed for Places search + a referrer-locked browser key for the map).
- **Single source of truth** — all 24 categories (search terms, scoring tiers, inference
  keywords, copy) derive from one config module (`src/lib/categories.ts`).

## Architecture

Discovery (Google Places, UK-restricted) → map to a `Business` with public signals →
deterministic 0–9 score → persist to Supabase (Prisma) → on-demand OpenAI enrichment
(cached) → render on a Google map with a ranked shortlist and review workflow. Auth and
tiering run in a Next.js 16 **Proxy** (`src/proxy.ts`).

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
Prisma 7 + `@prisma/adapter-pg` → Supabase Postgres · Google Places API (New) +
Google Maps JS · OpenAI (`gpt-4o-mini`) · Upstash Redis · Vercel.

## Local development

```bash
npm install
cp .env.example .env.local      # fill in your own keys
npm run db:push                 # sync the schema to your database
npm run db:seed                 # (optional) seed demo businesses
npm run dev
```

See [`.env.example`](.env.example) for the required variables. Validate with:

```bash
npm run lint
npm test
npm run build
```

## Docs

- [`ROADMAP.md`](ROADMAP.md) — planned enhancements.
