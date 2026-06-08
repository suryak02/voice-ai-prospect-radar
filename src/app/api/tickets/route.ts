import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTicket, getTickets } from "@/lib/data/businesses";
import { checkRateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";

const ticketSchema = z.object({
  businessId: z.string().trim().min(1).max(160),
  businessName: z.string().trim().min(1).max(180),
  score: z.number().int().min(0).max(9),
  status: z.enum(["open", "reviewed", "rejected"]),
});

export async function GET() {
  try {
    const tickets = await getTickets();
    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("Failed to load tickets. Returning an empty queue for demo stability.", error);
    return NextResponse.json({ tickets: [] });
  }
}

export async function POST(request: NextRequest) {
  cleanupRateLimitBuckets();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const rateLimit = await checkRateLimit({ key: `tickets:${ip}`, limit: 40, windowMs: 60 * 60 * 1000 });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Ticket action limit reached. Try again later.", resetAt: new Date(rateLimit.resetAt).toISOString() },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ticketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ticket fields.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const ticket = await createTicket(parsed.data);
    return NextResponse.json({ ticket }, { status: 201, headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) } });
  } catch (error) {
    console.error("Failed to persist ticket.", error);
    return NextResponse.json({ error: "Could not save ticket." }, { status: 500 });
  }
}
