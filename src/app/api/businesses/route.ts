import { NextResponse } from "next/server";
import { getBusinesses } from "@/lib/data/businesses";

export async function GET() {
  const businesses = await getBusinesses();
  return NextResponse.json({ businesses });
}
