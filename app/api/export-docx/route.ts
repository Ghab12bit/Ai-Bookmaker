import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
} from "docx";
import { BookBible, GeneratedChapter } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body: {
      bible: BookBible;
      chapters: GeneratedChapter[];
      coverUrl?: string;
    } = await req.json();

    const { bible, chapters, coverUrl } = body;

    const docChildren: Paragraph[] = [];

    // Fetch and embed the cover image if we have a URL
    if (coverUrl) {
      try {
        const imgRes = await fetch(coverUrl);
        const imgBuffer = await imgRes.arrayBuffer();
        docChildren.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: Buffer.from(imgBuffer),
                transformation: { width: 400, height: 533 },
                type: "png",
              }),
            ],
            alignment: AlignmentType.CENTER,
          })
        );
        docChildren.push(new Paragraph({ text: "" }));
      } catch {
        // Cover fetch failed — continue without it
      }
    }

    // Title page
    docChildren.push(
      new Paragraph({
        text: bible.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      })
    );

    if (bible.subtitle) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: bible.subtitle,
              italics: true,
              size: 28,
            }),
          ],
          alignment: AlignmentType.CENTER,
        })
      );
    }

    docChildren.push(new Paragraph({ text: "" }));
    docChildren.push(new Paragraph({ text: "" }));

    // Each chapter
    for (const chapter of chapters) {
      docChildren.push(
        new Paragraph({
          text: `Chapter ${chapter.chapterNumber}: ${chapter.title}`,
          heading: HeadingLevel.HEADING_1,
          pageBreakBefore: chapter.chapterNumber > 1,
        })
      );

      docChildren.push(new Paragraph({ text: "" }));

      // Split into paragraphs on double newlines
      const paragraphs = chapter.text
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean);

      for (const para of paragraphs) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: para, size: 24 })],
            spacing: { after: 200 },
          })
        );
      }
    }

    const doc = new Document({ sections: [{ children: docChildren }] });
    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);

    const safeTitle = bible.title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeTitle}.docx"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
