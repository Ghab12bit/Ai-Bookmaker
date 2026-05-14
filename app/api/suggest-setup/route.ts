import { NextRequest, NextResponse } from "next/server";
import { callOpenAI } from "@/lib/openai";
import {
  SETUP_PROPOSER_SYSTEM_PROMPT,
  buildSetupProposerUserPrompt,
} from "@/lib/prompts";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { vagueIdea } = await req.json();

    if (!vagueIdea || vagueIdea.trim().length < 3) {
      return NextResponse.json(
        { error: "Please describe your book idea (at least a few words)." },
        { status: 400 }
      );
    }

    const response = await callOpenAI({
      model: "gpt-4o-mini",
      systemPrompt: SETUP_PROPOSER_SYSTEM_PROMPT,
      userPrompt: buildSetupProposerUserPrompt(vagueIdea),
      responseFormat: "json",
      temperature: 0.9,
      maxTokens: 1500,
    });

    const proposal = JSON.parse(response);
    return NextResponse.json(proposal);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate proposal";
    console.error("Setup proposer error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
