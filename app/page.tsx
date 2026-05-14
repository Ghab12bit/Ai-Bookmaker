"use client";

import { useState } from "react";
import { BookBible, BookTone, GeneratedChapter, ChapterSummary, ReadingLevel } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "active" | "done" | "error";

type Step = {
  key: string;
  label: string;
  status: StepStatus;
};

type Proposal = {
  suggestedTitle: string;
  detectiveName: string;
  detectiveAge: number;
  detectiveBackstory: string;
  setting: string;
  geolocation: string;
  hobby: string;
  premise: string;
  tone: BookTone;
  readingLevel: ReadingLevel;
  bookContext: string;
  recommendedChapters: number;
  recommendedWordsPerChapter: number;
  rationale: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLastNWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/);
  return words.slice(-n).join(" ");
}

function formatTimeRemaining(secondsLeft: number): string {
  if (secondsLeft < 60) return `~${secondsLeft}s remaining`;
  const mins = Math.ceil(secondsLeft / 60);
  return `~${mins} min remaining`;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepRow({ step }: { step: Step }) {
  const icon =
    step.status === "done"
      ? "✓"
      : step.status === "error"
      ? "✗"
      : step.status === "active"
      ? "⟳"
      : "○";

  const color =
    step.status === "done"
      ? "text-green-500"
      : step.status === "error"
      ? "text-red-500"
      : step.status === "active"
      ? "text-amber-500 animate-pulse"
      : "text-neutral-600";

  return (
    <div className={`flex items-center gap-2 py-1 text-sm ${color}`}>
      <span className="w-5 text-center font-bold">{icon}</span>
      <span>{step.label}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  // === FLOW MODE ===
  const [mode, setMode] = useState<"idea" | "proposal" | "generating" | "complete">("idea");

  // === IDEA MODE ===
  const [vagueIdea, setVagueIdea] = useState("");
  const [isProposing, setIsProposing] = useState(false);

  // === PROPOSAL MODE ===
  const [proposal, setProposal] = useState<Proposal | null>(null);

  // === GENERATION STATE (preserved from v1) ===
  const [steps, setSteps] = useState<Step[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [completedChapters, setCompletedChapters] = useState(0);
  const [numChaptersForDisplay, setNumChaptersForDisplay] = useState(10);

  // ── Step helpers ─────────────────────────────────────────────────────────────

  function buildInitialSteps(numChapters: number): Step[] {
    const s: Step[] = [
      { key: "bible", label: "Building book bible", status: "pending" },
    ];
    for (let i = 1; i <= numChapters; i++) {
      s.push({
        key: `chapter-${i}`,
        label: `Writing chapter ${i} of ${numChapters}`,
        status: "pending",
      });
    }
    s.push({ key: "cover", label: "Generating cover", status: "pending" });
    s.push({ key: "docx", label: "Packaging DOCX", status: "pending" });
    return s;
  }

  function setStep(key: string, status: StepStatus) {
    setSteps((prev) =>
      prev.map((s) => (s.key === key ? { ...s, status } : s))
    );
  }

  // ── Orchestration ─────────────────────────────────────────────────────────────

  async function generate(input: {
    detectiveName: string;
    setting: string;
    hobby: string;
    premise: string;
    numChapters: number;
    wordsPerChapter: number;
    tone: BookTone;
    readingLevel: ReadingLevel;
    geolocation?: string;
    bookContext?: string;
  }) {
    setErrorMsg(null);
    setDownloadUrl(null);
    setCompletedChapters(0);
    setNumChaptersForDisplay(input.numChapters);
    const initialSteps = buildInitialSteps(input.numChapters);
    setSteps(initialSteps);
    setStartTime(Date.now());

    try {
      // 1. Book bible
      setStep("bible", "active");
      const bibleRes = await fetch("/api/generate-bible", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const bibleData = await bibleRes.json();
      if (!bibleRes.ok || bibleData.error)
        throw new Error(bibleData.error || "Bible generation failed");
      const bible: BookBible = bibleData.bible;
      setStep("bible", "done");

      // 2. Chapters — one at a time, passing rolling context
      const chapters: GeneratedChapter[] = [];
      const summaries: ChapterSummary[] = [];
      let previousChapterEnding = "";

      for (let i = 1; i <= input.numChapters; i++) {
        setStep(`chapter-${i}`, "active");

        const chapterRes = await fetch("/api/generate-chapter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bible,
            chapterNumber: i,
            previousSummaries: summaries,
            previousChapterEnding,
            tone: input.tone,
            readingLevel: input.readingLevel,
            geolocation: input.geolocation,
            bookContext: input.bookContext,
          }),
        });
        const chapterData = await chapterRes.json();
        if (!chapterRes.ok || chapterData.error)
          throw new Error(chapterData.error || `Chapter ${i} failed`);

        const chapter: GeneratedChapter = chapterData.chapter;
        chapters.push(chapter);
        previousChapterEnding = getLastNWords(chapter.text, 300);

        const summaryRes = await fetch("/api/generate-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chapterText: chapter.text, chapterNumber: i }),
        });
        const summaryData = await summaryRes.json();
        if (!summaryRes.ok || summaryData.error)
          throw new Error(summaryData.error || `Summary for chapter ${i} failed`);

        summaries.push(summaryData.chapterSummary);
        setStep(`chapter-${i}`, "done");
        setCompletedChapters(i);
      }

      // 3. Cover (optional)
      setStep("cover", "active");
      let coverUrl: string | undefined;
      try {
        const coverRes = await fetch("/api/generate-cover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: bible.title,
            setting: input.setting,
            detectiveHobby: input.hobby,
          }),
        });
        const coverData = await coverRes.json();
        coverUrl = coverData.coverUrl ?? undefined;
      } catch {
        // Cover is optional — swallow the error
      }
      setStep("cover", "done");

      // 4. Export DOCX
      setStep("docx", "active");
      const docxRes = await fetch("/api/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bible, chapters, coverUrl }),
      });
      if (!docxRes.ok) throw new Error("DOCX export failed");

      const blob = await docxRes.blob();
      const url = URL.createObjectURL(blob);
      const safeTitle = bible.title
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .replace(/\s+/g, "_");
      setDownloadUrl(url);
      setDownloadName(`${safeTitle}.docx`);
      setStep("docx", "done");
      setMode("complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setErrorMsg(msg);
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "active" ? { ...s, status: "error" } : s
        )
      );
    }
  }

  // ── Time estimate ─────────────────────────────────────────────────────────────

  function timeRemainingLabel(): string | null {
    if (mode !== "generating" || !startTime || completedChapters === 0) return null;
    const elapsed = (Date.now() - startTime) / 1000;
    const perChapter = elapsed / completedChapters;
    const remaining = (numChaptersForDisplay - completedChapters) * perChapter;
    return formatTimeRemaining(Math.round(remaining));
  }

  // ── Proposal handlers ──────────────────────────────────────────────────────

  async function handleProposeSetup() {
    setIsProposing(true);
    try {
      const res = await fetch("/api/suggest-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vagueIdea }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProposal(data);
      setMode("proposal");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      alert(msg);
    } finally {
      setIsProposing(false);
    }
  }

  function updateProposal(field: keyof Proposal, value: string | number) {
    if (!proposal) return;
    setProposal({ ...proposal, [field]: value });
  }

  async function handleGenerateBook() {
    if (!proposal) return;
    setMode("generating");
    await generate({
      detectiveName: proposal.detectiveName,
      setting: proposal.setting,
      hobby: proposal.hobby,
      premise: `${proposal.premise} ${proposal.detectiveBackstory}`.trim(),
      numChapters: proposal.recommendedChapters,
      wordsPerChapter: proposal.recommendedWordsPerChapter,
      tone: proposal.tone,
      readingLevel: proposal.readingLevel,
      geolocation: proposal.geolocation,
      bookContext: proposal.bookContext,
    });
  }

  const timeLabel = timeRemainingLabel();

  const exampleIdeas = [
    "A clock restorer in a small Ohio town investigates a death at an estate sale",
    "A retired park ranger in Appalachia finds a body during a heritage festival",
    "A beekeeping widow in Vermont solves a murder at the county fair",
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  // === MODE: IDEA ===
  if (mode === "idea") {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-full px-4 py-1.5 text-xs text-amber-500 font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              AI-POWERED &bull; Cozy Mysteries
            </div>
            <h1 className="text-5xl font-bold text-neutral-100 tracking-tight mb-4">
              AI Bookmaker
            </h1>
            <p className="text-neutral-400 text-lg max-w-lg mx-auto">
              Describe your idea and I&apos;ll suggest a complete setup. You review, tweak, then generate your full novella.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-neutral-300">Your book idea</label>
            <textarea
              value={vagueIdea}
              onChange={(e) => setVagueIdea(e.target.value)}
              rows={4}
              placeholder="Even a rough sentence works. What's the vibe? Where's it set? Who's the detective?"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-4 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-700 resize-none text-sm"
            />

            <div>
              <p className="text-xs text-neutral-500 mb-2">Or try an example:</p>
              <div className="flex flex-wrap gap-2">
                {exampleIdeas.map((idea) => (
                  <button
                    key={idea}
                    onClick={() => setVagueIdea(idea)}
                    className="text-xs px-3 py-2 rounded-full bg-neutral-900 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-neutral-200 transition"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleProposeSetup}
              disabled={!vagueIdea.trim() || isProposing}
              className="w-full bg-amber-800 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition text-sm"
            >
              {isProposing ? "Thinking..." : "Suggest a setup →"}
            </button>

            <p className="text-xs text-neutral-600 text-center">
              Takes about 5 seconds. You can regenerate as many times as you want.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // === MODE: PROPOSAL ===
  if (mode === "proposal" && proposal) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setMode("idea")}
            className="text-xs text-neutral-500 hover:text-neutral-300 mb-6 transition"
          >
            ← back to idea
          </button>

          <h2 className="text-2xl font-bold mb-1">Here&apos;s a setup for your book</h2>
          <p className="text-neutral-400 text-sm mb-8 italic">{proposal.rationale}</p>

          <div className="space-y-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">

            <ProposalField label="Title" value={proposal.suggestedTitle} onChange={(v) => updateProposal("suggestedTitle", v)} />

            <div className="grid grid-cols-2 gap-4">
              <ProposalField label="Detective name" value={proposal.detectiveName} onChange={(v) => updateProposal("detectiveName", v)} />
              <ProposalField label="Age" type="number" value={String(proposal.detectiveAge)} onChange={(v) => updateProposal("detectiveAge", Number(v))} />
            </div>

            <ProposalField label="Backstory" value={proposal.detectiveBackstory} onChange={(v) => updateProposal("detectiveBackstory", v)} />
            <ProposalField label="Setting (descriptive)" value={proposal.setting} onChange={(v) => updateProposal("setting", v)} />
            <ProposalField label="Real-world location (anchors specificity)" value={proposal.geolocation} onChange={(v) => updateProposal("geolocation", v)} />
            <ProposalField label="Hobby / job" value={proposal.hobby} onChange={(v) => updateProposal("hobby", v)} />

            <ProposalTextarea label="Premise" value={proposal.premise} onChange={(v) => updateProposal("premise", v)} rows={4} />
            <ProposalTextarea label="Additional context" value={proposal.bookContext} onChange={(v) => updateProposal("bookContext", v)} rows={4} />

            <div className="grid grid-cols-2 gap-4">
              <ProposalSelect
                label="Tone"
                value={proposal.tone}
                onChange={(v) => updateProposal("tone", v as BookTone)}
                options={[
                  { value: "warm_cozy", label: "Warm & Cozy" },
                  { value: "dry_witty", label: "Dry & Witty" },
                  { value: "literary_quiet", label: "Literary & Quiet" },
                  { value: "light_comedic", label: "Light & Comedic" },
                  { value: "suspenseful", label: "Suspenseful" },
                  { value: "nostalgic_wistful", label: "Nostalgic & Wistful" },
                ]}
              />
              <ProposalSelect
                label="Reading level"
                value={proposal.readingLevel}
                onChange={(v) => updateProposal("readingLevel", v as ReadingLevel)}
                options={[
                  { value: "easy", label: "Easy (KU binge)" },
                  { value: "standard", label: "Standard" },
                  { value: "elevated", label: "Elevated (book club)" },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ProposalField label="Chapters" type="number" value={String(proposal.recommendedChapters)} onChange={(v) => updateProposal("recommendedChapters", Number(v))} />
              <ProposalField label="Words per chapter" type="number" value={String(proposal.recommendedWordsPerChapter)} onChange={(v) => updateProposal("recommendedWordsPerChapter", Number(v))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              onClick={handleProposeSetup}
              disabled={isProposing}
              className="px-4 py-3 rounded-xl border border-neutral-700 hover:border-neutral-500 text-neutral-300 text-sm transition disabled:opacity-40"
            >
              {isProposing ? "Regenerating..." : "↻ Regenerate setup"}
            </button>
            <button
              onClick={handleGenerateBook}
              className="px-4 py-3 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-medium text-sm transition"
            >
              Generate my book →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // === MODE: GENERATING ===
  if (mode === "generating") {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-full px-4 py-1.5 text-xs text-amber-500 font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse" />
              Writing your novel…
            </div>
            <h1 className="text-4xl font-bold text-neutral-100 tracking-tight mb-3">AI Bookmaker</h1>
            {timeLabel && <p className="text-neutral-500 text-sm">{timeLabel}</p>}
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-1">
            {steps.map((step) => (
              <StepRow key={step.key} step={step} />
            ))}
            {errorMsg && (
              <div className="mt-4 space-y-3 pt-3 border-t border-neutral-800">
                <p className="text-red-400 text-sm">{errorMsg}</p>
                <button
                  onClick={() => {
                    setSteps([]);
                    setErrorMsg(null);
                    setMode("proposal");
                  }}
                  className="text-amber-600 underline text-xs"
                >
                  Go back and try again
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // === MODE: COMPLETE ===
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-16">
      <div className="max-w-2xl mx-auto text-center">
        <div className="text-6xl mb-6">📖</div>
        <h2 className="text-3xl font-bold text-neutral-100 mb-3">Your novel is ready!</h2>
        <p className="text-neutral-400 mb-8">
          {numChaptersForDisplay} chapters written and packaged as a Word document.
        </p>
        {downloadUrl && (
          <a
            href={downloadUrl}
            download={downloadName}
            className="inline-block bg-amber-800 hover:bg-amber-700 text-white font-semibold py-3 px-8 rounded-xl transition"
          >
            Download your novel
          </a>
        )}
        <div className="mt-6">
          <button
            onClick={() => {
              setDownloadUrl(null);
              setSteps([]);
              setProposal(null);
              setVagueIdea("");
              setErrorMsg(null);
              setMode("idea");
            }}
            className="text-neutral-500 hover:text-neutral-300 underline text-sm transition"
          >
            Write another novel
          </button>
        </div>
      </div>
    </main>
  );
}

// ─── Proposal form field components ───────────────────────────────────────────

function ProposalField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-700"
      />
    </div>
  );
}

function ProposalTextarea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-400 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-700 resize-none"
      />
    </div>
  );
}

function ProposalSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-400 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-amber-700"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
