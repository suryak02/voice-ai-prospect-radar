# Voice AI Prospect Map — case study

## Summary

Voice AI Prospect Map is a deployed portfolio MVP for a practical sales-intelligence workflow: helping Voice AI companies find local businesses that are likely to benefit from AI call handling, appointment booking, reminders, and customer-service automation.

The project combines real business discovery, explainable scoring, geospatial review, and on-demand AI prospect briefs in one workflow.

## Problem

Voice AI vendors can target many verticals: dentists, clinics, salons, trades, professional services, and more. A raw directory or map search does not answer the important question:

> Which local businesses are actually worth contacting first, and why?

A useful prospecting tool needs to combine public data with business logic:

- Is this category appointment-heavy?
- Does the business depend on phone calls?
- Is there website or booking friction?
- Are there enough reviews to suggest demand?
- Is the prospect likely to have missed-call or front-desk pain?
- Can a human salesperson quickly understand the reason for the ranking?

## Product workflow

1. Browse the saved all-vertical prospect map.
2. Search a UK area and selected business categories using Google Places.
3. Score and rank each prospect from 0 to 9.
4. Review prospects on a map and shortlist.
5. Open a prospect detail panel with score reasoning.
6. Generate an AI prospect brief and outreach angle.
7. Save follow-up decisions in a ticket-style review queue.

## Architecture

```text
Next.js UI
  ├─ search controls
  ├─ Google Map
  ├─ ranked shortlist
  ├─ prospect detail panel
  └─ ticket queue

Next.js API routes
  ├─ businesses
  ├─ prospect-search
  ├─ enrich
  ├─ tickets
  └─ me

Data and external services
  ├─ Supabase Postgres via Prisma
  ├─ Google Places API
  ├─ Google Maps JavaScript API
  ├─ OpenAI API
  └─ Upstash Redis
```

## Scoring design

The score is deterministic and explainable. It uses public signals rather than letting an LLM silently rank prospects.

Signals include:

- business category fit
- call dependency
- appointment complexity
- website and booking friction
- review demand
- rating and review-volume demand/friction proxies
- confidence penalty for missing public data

This makes the result easier to defend in a demo or interview: the AI writes briefs, but the ranking itself is transparent.

## AI design

OpenAI enrichment is triggered only when a user requests it. The generated brief is saved to Postgres and reused with a cooldown.

The app has two AI modes:

- standard brief from structured business signals
- admin-only deep research using website text when it can be fetched

This keeps the demo cost-controlled while still showing how a higher-value research tier could work.

## Deployment and operational choices

- Vercel hosts the app.
- Supabase Postgres stores businesses, AI enrichment, and tickets.
- Prisma 7 handles the data layer.
- Upstash Redis provides shared rate limits and short-lived search caching when configured.
- Basic auth creates demo/admin access tiers.
- Server and browser Google keys are split so the browser key can be referrer-restricted.
- The public GitHub repo is curated separately from private handoff and internal planning notes.

## Tradeoffs

- The app is a portfolio MVP, not a full CRM.
- The scoring rubric is hand-designed and explainable rather than statistically calibrated from conversion data.
- Live search is intentionally capped and cached to protect API cost.
- Deep research is admin-only because website reading and LLM calls are more expensive.
- Basic auth is enough for a gated demo, but a commercial version would use real accounts and audit logs.

## What I would improve next

- Add calibrated scoring from real outreach outcomes.
- Ingest review text and missed-call style complaint signals where API access and terms allow it.
- Add CRM export and sales-team assignment workflows.
- Add a public limited demo mode with stricter quotas.
- Add screenshot/video assets directly to the public README.
- Add more automated tests around API validation, ticket state transitions, and data persistence edge cases.

## Resume-safe summary

Built and deployed a full-stack Voice AI prospect-intelligence app that ranks UK businesses using Google Places data, explainable scoring, OpenAI-generated prospect briefs, Supabase/Postgres persistence, Redis-backed cost controls, and a Vercel-hosted map interface.
