import { NextRequest, NextResponse } from "next/server";
import { callOpenAI } from "@/lib/openai";
import {
  CHAPTER_GENERATOR_SYSTEM_PROMPT,
  buildChapterUserPrompt,
} from "@/lib/prompts";
import { BookBible, ChapterSummary } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body: {
      bible: BookBible;
      chapterNumber: number;
      previousSummaries: ChapterSummary[];
      previousChapterEnding: string;
    } = await req.json();

    const { bible, chapterNumber, previousSummaries, previousChapterEnding } =
      body;

    const chapterOutline = bible.chapterOutlines.find(
      (c) => c.chapterNumber === chapterNumber
    );
    if (!chapterOutline) {
      return NextResponse.json(
        { error: `Chapter ${chapterNumber} outline not found in bible` },
        { status: 400 }
      );
    }

    // Collect vocabulary used in the last 3 chapters to avoid repetition
    const recentSummaries = previousSummaries.slice(-3);
    const seen = new Set<string>();
    const overusedVocabulary: string[] = [];
    for (const word of recentSummaries.flatMap((s) => s.vocabularyUsed)) {
      if (!seen.has(word)) {
        seen.add(word);
        overusedVocabulary.push(word);
      }
    }

    const chapterText = await callOpenAI({
      model: "gpt-4o",
      systemPrompt: CHAPTER_GENERATOR_SYSTEM_PROMPT,
      userPrompt: buildChapterUserPrompt({
        bible,
        chapterOutline,
        previousSummaries,
        previousChapterEnding,
        overusedVocabulary,
        targetWordCount: Math.round(
          (bible as BookBible & { wordsPerChapter?: number })
            .wordsPerChapter ?? 2800
        ),
      }),
      responseFormat: "text",
      maxTokens: 6000,
    });

    const wordCount = chapterText.trim().split(/\s+/).length;

    return NextResponse.json({
      chapter: {
        chapterNumber,
        title: chapterOutline.title,
        text: chapterText,
        wordCount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
