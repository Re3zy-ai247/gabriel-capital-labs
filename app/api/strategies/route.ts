import { NextResponse } from "next/server";
import { STRATEGIES } from "@/lib/strategies";
export async function GET() { return NextResponse.json({ strategies: STRATEGIES }); }
