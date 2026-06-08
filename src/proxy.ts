import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Whole-site password gate with two access tiers (Next 16 "Proxy").
 *
 * - admin (SITE_USERNAME / SITE_PASSWORD): full access, incl. deep research.
 * - demo  (DEMO_USERNAME / DEMO_PASSWORD): standard access only.
 *
 * The matched tier is forwarded to the app as an authoritative `x-user-tier`
 * request header (any client-supplied value is stripped first), so API routes
 * can enforce tier without trusting the client. Local development stays open
 * when SITE_PASSWORD is unset; production fails closed.
 */
type Tier = "admin" | "demo";

function matchTier(user: string, pass: string): Tier | null {
  const adminUser = process.env.SITE_USERNAME || "demo";
  const adminPass = process.env.SITE_PASSWORD;
  const demoUser = process.env.DEMO_USERNAME;
  const demoPass = process.env.DEMO_PASSWORD;

  if (adminPass && user === adminUser && pass === adminPass) return "admin";
  if (demoPass && demoUser && user === demoUser && pass === demoPass) return "demo";
  return null;
}

function allow(request: NextRequest, tier: Tier) {
  const headers = new Headers(request.headers);
  headers.set("x-user-tier", tier);
  return NextResponse.next({ request: { headers } });
}

export function proxy(request: NextRequest) {
  // No admin password configured → open site only in local development.
  if (!process.env.SITE_PASSWORD && process.env.NODE_ENV !== "production") return allow(request, "admin");

  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const separator = decoded.indexOf(":");
      if (separator < 0) return challenge();
      const tier = matchTier(decoded.slice(0, separator), decoded.slice(separator + 1));
      if (tier) return allow(request, tier);
    } catch {
      // malformed header → challenge
    }
  }

  return challenge();
}

function challenge() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Voice AI Prospect Map"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
