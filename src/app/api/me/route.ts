import { NextRequest, NextResponse } from "next/server";

// Reports the caller's access tier (set authoritatively by the proxy). The
// client uses this to decide whether to show admin-only controls like the
// deep-research depth toggle.
export async function GET(request: NextRequest) {
  const tier = request.headers.get("x-user-tier") === "admin" ? "admin" : "demo";
  return NextResponse.json({ tier });
}
