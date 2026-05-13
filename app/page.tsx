"use client";

import { useState } from "react";
import { BookBible, GeneratedChapter, ChapterSummary, UserInput } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "active" | "done" | "error";

type Step = {
  key: string;
  label: string;
  status: StepStatus;
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
      ? "text-green-600"
      : step.status === "error"
      ? "text-red-500"
      : step.status === "active"
      ? "text-amber-600 animate-pulse"
      : "text-gray-400";

  return (
    <div className={`flex items-center gap-2 py-1 text-sm ${color}`}>
      <span className="w-5 text-center font-bold">{icon}</span>
      <span>{step.label}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [form, setForm] = useState<UserInput>({
    detectiveName: "",
    setting: "",
    hobby: "",
    premise: "",
    numChapters: 10,
    wordsPerChapter: 2800,
  });

  const [generating, setGenerating] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [completedChapters, setCompletedChapters] = useState(0);

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

  async function generate() {
    setErrorMsg(null);
    setDownloadUrl(null);
    setCompletedChapters(0);
    const initialSteps = buildInitialSteps(form.numChapters);
    setSteps(initialSteps);
    setGenerating(true);
    setStartTime(Date.now());

    try {
      // 1. Book bible
      setStep("bible", "active");
      const bibleRes = await fetch("/api/generate-bible", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

      for (let i = 1; i <= form.numChapters; i++) {
        setStep(`chapter-${i}`, "active");

        const chapterRes = await fetch("/api/generate-chapter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bible,
            chapterNumber: i,
            previousSummaries: summaries,
            previousChapterEnding,
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
          throw new Error(
            summaryData.error || `Summary for chapter ${i} failed`
          );

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
            setting: form.setting,
            detectiveHobby: form.hobby,
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setErrorMsg(msg);
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "active" ? { ...s, status: "error" } : s
        )
      );
    } finally {
      setGenerating(false);
    }
  }

  // ── Time estimate ─────────────────────────────────────────────────────────────

  function timeRemainingLabel(): string | null {
    if (!generating || !startTime || completedChapters === 0) return null;
    const elapsed = (Date.now() - startTime) / 1000;
    const perChapter = elapsed / completedChapters;
    const remaining = (form.numChapters - completedChapters) * perChapter;
    return formatTimeRemaining(Math.round(remaining));
  }

  const timeLabel = timeRemainingLabel();

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-amber-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-amber-900 tracking-tight">
            Cozy Mystery Generator
          </h1>
          <p className="mt-2 text-amber-700 text-lg">
            Fill in the details and we&apos;ll write your 25,000-word novella.
          </p>
        </div>

        {/* Form */}
        {!generating && !downloadUrl && (
          <div className="bg-white rounded-2xl shadow-md p-8 space-y-6">
            <Field
              label="Detective's first name"
              hint='e.g. "Eleanor"'
              value={form.detectiveName}
              onChange={(v) => setForm({ ...form, detectiveName: v })}
            />
            <Field
              label="Setting"
              hint='e.g. "Willow Creek, a coastal town in Maine"'
              value={form.setting}
              onChange={(v) => setForm({ ...form, setting: v })}
            />
            <Field
              label="Detective's quirky hobby or job"
              hint='e.g. "owns a bookshop, lives with a Siamese cat named Watson"'
              value={form.hobby}
              onChange={(v) => setForm({ ...form, hobby: v })}
            />
            <TextareaField
              label="Premise"
              hint='e.g. "When the town&apos;s beloved baker is found dead at the annual pie contest..."'
              value={form.premise}
              onChange={(v) => setForm({ ...form, premise: v })}
            />
            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label="Number of chapters"
                value={form.numChapters}
                min={6}
                max={15}
                onChange={(v) => setForm({ ...form, numChapters: v })}
              />
              <NumberField
                label="Words per chapter"
                value={form.wordsPerChapter}
                min={1500}
                max={4000}
                step={100}
                onChange={(v) => setForm({ ...form, wordsPerChapter: v })}
              />
            </div>

            {errorMsg && (
              <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">
                {errorMsg}
              </p>
            )}

            <button
              onClick={generate}
              disabled={
                !form.detectiveName ||
                !form.setting ||
                !form.hobby ||
                !form.premise
              }
              className="w-full bg-amber-700 hover:bg-amber-800 disabled:bg-amber-300 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors"
            >
              Generate my cozy mystery
            </button>
            <p className="text-center text-amber-600 text-sm">
              Estimated time:{" "}
              {Math.round((form.numChapters * 30) / 60)}–
              {Math.round((form.numChapters * 45) / 60)} minutes
            </p>
          </div>
        )}

        {/* Progress */}
        {(generating || (steps.length > 0 && !downloadUrl)) && (
          <div className="bg-white rounded-2xl shadow-md p-8 space-y-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-amber-900">
                Writing your novel…
              </h2>
              {timeLabel && (
                <span className="text-sm text-amber-600">{timeLabel}</span>
              )}
            </div>
            {steps.map((step) => (
              <StepRow key={step.key} step={step} />
            ))}
            {errorMsg && (
              <div className="mt-4 space-y-3">
                <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">
                  {errorMsg}
                </p>
                <button
                  onClick={() => {
                    setSteps([]);
                    setErrorMsg(null);
                    setGenerating(false);
                  }}
                  className="text-amber-700 underline text-sm"
                >
                  Start over
                </button>
              </div>
            )}
          </div>
        )}

        {/* Download */}
        {downloadUrl && (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center space-y-4">
            <div className="text-5xl">📖</div>
            <h2 className="text-2xl font-bold text-amber-900">
              Your novel is ready!
            </h2>
            <p className="text-amber-700">
              {form.numChapters} chapters written and packaged as a Word
              document.
            </p>
            <a
              href={downloadUrl}
              download={downloadName}
              className="inline-block bg-amber-700 hover:bg-amber-800 text-white font-semibold py-3 px-8 rounded-xl text-lg transition-colors"
            >
              Download your novel
            </a>
            <div>
              <button
                onClick={() => {
                  setDownloadUrl(null);
                  setSteps([]);
                  setForm({
                    detectiveName: "",
                    setting: "",
                    hobby: "",
                    premise: "",
                    numChapters: 10,
                    wordsPerChapter: 2800,
                  });
                }}
                className="text-amber-700 underline text-sm mt-2"
              >
                Write another novel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Small form field components ──────────────────────────────────────────────

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-amber-900 mb-1">
        {label}
      </label>
      <input
        type="text"
        placeholder={hint}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
    </div>
  );
}

function TextareaField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-amber-900 mb-1">
        {label}
      </label>
      <textarea
        placeholder={hint}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-amber-900 mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
    </div>
  );
}
