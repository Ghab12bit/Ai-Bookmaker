import { NextRequest, NextResponse } from "next/server";
import { callOpenAI } from "@/lib/openai";
import {
  BOOK_BIBLE_SYSTEM_PROMPT,
  buildBookBibleUserPrompt,
} from "@/lib/prompts";
import { UserInput, BookBible } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const input: UserInput = await req.json();

    let raw = await callOpenAI({
      model: "gpt-4o-mini",
      systemPrompt: BOOK_BIBLE_SYSTEM_PROMPT,
      userPrompt: buildBookBibleUserPrompt(input),
      responseFormat: "json",
      maxTokens: 8000,
    });

    let bible: BookBible;
    try {
      bible = JSON.parse(raw);
    } catch {
      // Retry once with an explicit correction nudge
      raw = await callOpenAI({
        model: "gpt-4o-mini",
        systemPrompt: BOOK_BIBLE_SYSTEM_PROMPT,
        userPrompt:
          buildBookBibleUserPrompt(input) +
          "\n\nYour last response was not valid JSON. Try again, more carefully.",
        responseFormat: "json",
        maxTokens: 8000,
      });
      bible = JSON.parse(raw);
    }

    return NextResponse.json({ bible });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
