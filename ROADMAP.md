# Roadmap / next steps

Planned enhancements intentionally kept out of the current build to control cost
and scope. Documented so the design intent is clear even where it isn't shipped.

## 1. Google Maps API key: server / browser split

Today a single key serves both the server-side Places search and the browser
Maps JS. It should be split into two:

- a **server-only** key (`GOOGLE_MAPS_API_KEY`) restricted by **API** to
  *Places API (New)*, with **no IP/referrer restriction** — Vercel's serverless
  egress IPs rotate, so an IP restriction silently breaks live search;
- a **browser** key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) restricted by **HTTP
  referrer** to the deployment domains.

This protects the publicly-exposed browser key from abuse while keeping
server-side search working from any Vercel region.

## 2. "Deep web research" AI tier

The shipped AI layer (OpenAI `gpt-4o-mini`) writes a personalized summary +
outreach angle from each business's Google signals, cached in the database with
a 7-day cooldown. A funded/premium tier would go further, on-demand for a
selected prospect:

- fetch and read the business's website + recent reviews,
- extract concrete signals (services offered, booking setup, named pain points),
- produce a deeper, source-grounded prospect brief.

It is slower and more expensive per business, so it stays behind the same
DB cache + weekly cooldown and runs only when explicitly requested.
