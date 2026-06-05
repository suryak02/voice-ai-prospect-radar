import { NextRequest, NextResponse } from "next/server";
import { createTicket, getTickets } from "@/lib/data/businesses";
import type { Ticket } from "@/lib/types";

export async function GET() {
  const tickets = await getTickets();
  return NextResponse.json({ tickets });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Pick<Ticket, "businessId" | "businessName" | "score" | "status">;

  if (!body.businessId || !body.businessName || typeof body.score !== "number" || !body.status) {
    return NextResponse.json({ error: "Missing ticket fields" }, { status: 400 });
  }

  const ticket = await createTicket(body);
  return NextResponse.json({ ticket }, { status: 201 });
}
