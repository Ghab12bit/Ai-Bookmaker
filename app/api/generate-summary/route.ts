import { NextRequest, NextResponse } from "next/server";
import { callOpenAI } from "@/lib/openai";
import {
  CHAPTER_SUMMARIZER_SYSTEM_PROMPT,
  buildSummarizerUserPrompt,
} from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
    const { chapterText, chapterNumber }: { chapterText: string; chapterNumber: number } =
      await req.json();

    const raw = await callOpenAI({
      model: "gpt-4o-mini",
      systemPrompt: CHAPTER_SUMMARIZER_SYSTEM_PROMPT,
      userPrompt: buildSummarizerUserPrompt(chapterText, chapterNumber),
      responseFormat: "json",
      maxTokens: 500,
    });

    const parsed = JSON.parse(raw) as {
      summary: string;
      vocabularyUsed: string[];
    };

    return NextResponse.json({
      chapterSummary: {
        chapterNumber,
        summary: parsed.summary,
        vocabularyUsed: parsed.vocabularyUsed,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
