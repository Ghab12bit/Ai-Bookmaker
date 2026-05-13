import { NextRequest, NextResponse } from "next/server";
import { generateCover } from "@/lib/falai";

export async function POST(req: NextRequest) {
  try {
    const body: { title: string; setting: string; detectiveHobby: string } =
      await req.json();

    const coverUrl = await generateCover(body);
    return NextResponse.json({ coverUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Cover is optional — return null rather than a 500 so the book still delivers
    return NextResponse.json({ coverUrl: null, warning: message });
  }
}
