"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PinDot } from "@/components/canvas/pin-dot";
import { PinThread } from "@/components/canvas/pin-thread";
import { Check, Send } from "lucide-react";
import { timeRemaining } from "@/lib/utils";
import type { Review, Version, Pin } from "@/lib/types";

export default function ClientReviewPage() {
  const { token } = useParams<{ token: string }>();
  const supabase = createClient();
  const imageRef = useRef<HTMLDivElement>(null);

  const [review, setReview] = useState<Review | null>(null);
  const [, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState<Version | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);

  const [clientName, setClientName] = useState("");
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [approved, setApproved] = useState(false);

  const loadReview = useCallback(async () => {
    const { data: reviewData } = await supabase
      .from("reviews")
      .select("*")
      .eq("client_token", token)
      .single();

    if (!reviewData) {
      setLoading(false);
      setNotReady(true);
      return;
    }

    if (!reviewData.client_link_active) {
      setLoading(false);
      setNotReady(true);
      return;
    }

    setReview(reviewData);

    const { data: versionsData } = await supabase
      .from("versions")
      .select("*")
      .eq("review_id", reviewData.id)
      .order("version_number", { ascending: true });

    setVersions(versionsData || []);
    if (versionsData && versionsData.length > 0) {
      const latest = versionsData[versionsData.length - 1];
      setCurrentVersion((prev) => prev || latest);
    }

    setLoading(false);
  }, [supabase, token]);

  const loadPins = useCallback(async () => {
    if (!currentVersion) return;
    // Only show client-authored pins to clients
    const { data: pinsData } = await supabase
      .from("pins")
      .select("*, comments(*)")
      .eq("version_id", currentVersion.id)
      .eq("author_type", "client")
      .order("created_at", { ascending: true });
    setPins(pinsData || []);
  }, [supabase, currentVersion]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  useEffect(() => {
    const stored = localStorage.getItem("adclear_client_name");
    if (stored) {
      setClientName(stored);
    } else {
      setShowNamePrompt(true);
    }
  }, []);

  // Realtime
  useEffect(() => {
    if (!currentVersion) return;
    const channel = supabase
      .channel(`client-pins-${currentVersion.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pins",
          filter: `version_id=eq.${currentVersion.id}`,
        },
        () => loadPins()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments" },
        () => loadPins()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentVersion, loadPins]);

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) return;
    localStorage.setItem("adclear_client_name", clientName.trim());
    setClientName(clientName.trim());
    setShowNamePrompt(false);
  }

  async function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!currentVersion || !clientName || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const { data: pin } = await supabase
      .from("pins")
      .insert({
        version_id: currentVersion.id,
        x_pct: Math.round(x * 100) / 100,
        y_pct: Math.round(y * 100) / 100,
        author_type: "client",
        author_name: clientName,
      })
      .select()
      .single();

    if (pin) {
      setActivePin(pin.id);
      loadPins();
    }
  }

  async function handleSubmitFeedback() {
    if (!review) return;
    setSubmitting(true);
    await supabase.from("feedback_rounds").insert({
      review_id: review.id,
      submitted_by_type: "client",
    });
    setSubmitting(false);
    setSubmitted(true);
  }

  async function handleApprove() {
    if (!review) return;
    await supabase
      .from("reviews")
      .update({ status: "approved" })
      .eq("id", review.id);
    setApproved(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <p className="text-neutral-400 text-sm">Loading…</p>
      </div>
    );
  }

  if (notReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-neutral-900 mb-2">
            Not ready yet
          </h1>
          <p className="text-sm text-neutral-500">
            This design isn&apos;t ready for review yet. Please check back later
            or contact your account manager.
          </p>
        </div>
      </div>
    );
  }

  if (!review) return null;

  return (
    <div className="h-screen flex flex-col bg-neutral-50">
      {/* Name prompt */}
      <Dialog open={showNamePrompt} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Welcome to the review</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleNameSubmit} className="space-y-4 mt-2">
            <p className="text-sm text-neutral-600">
              Please enter your name so we know who&apos;s providing feedback.
            </p>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Your name"
              required
              autoFocus
            />
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="border-b border-neutral-200 bg-white px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-neutral-900">
            {review.title}
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Review for {review.client_name}
            {review.feedback_deadline &&
              ` · ${timeRemaining(review.feedback_deadline)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!approved && !submitted && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSubmitFeedback}
                disabled={submitting || pins.length === 0}
              >
                <Send className="h-3 w-3 mr-1.5" />
                {submitting ? "Sending…" : "Submit feedback"}
              </Button>
              <Button size="sm" onClick={handleApprove}>
                <Check className="h-3 w-3 mr-1.5" />
                Approve design
              </Button>
            </>
          )}
          {submitted && (
            <p className="text-sm text-emerald-600 font-medium">
              Feedback submitted — thank you!
            </p>
          )}
          {approved && (
            <p className="text-sm text-emerald-600 font-medium">
              Design approved — thank you!
            </p>
          )}
        </div>
      </header>

      {/* Canvas + panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-neutral-100">
          {currentVersion?.file_type === "image" ? (
            <div
              ref={imageRef}
              className="relative cursor-crosshair max-w-full max-h-full"
              onClick={handleCanvasClick}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentVersion.file_url}
                alt={review.title}
                className="max-w-full max-h-[calc(100vh-120px)] rounded-md shadow-sm"
                draggable={false}
              />
              {pins.map((pin, i) => (
                <PinDot
                  key={pin.id}
                  number={i + 1}
                  x={pin.x_pct}
                  y={pin.y_pct}
                  resolved={pin.resolved}
                  active={activePin === pin.id}
                  onClick={() =>
                    setActivePin(activePin === pin.id ? null : pin.id)
                  }
                />
              ))}
            </div>
          ) : currentVersion?.file_type === "pdf" ? (
            <iframe
              src={currentVersion.file_url}
              className="w-full h-[calc(100vh-200px)] border-0"
              title="Design PDF"
            />
          ) : null}
        </div>

        {/* Right panel */}
        <div className="w-80 border-l border-neutral-200 bg-white overflow-y-auto flex-shrink-0">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-900">
              Your feedback
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Click on the design to add a comment
            </p>
          </div>
          {pins.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-neutral-400">
                Click anywhere on the design to drop a pin and leave feedback
              </p>
            </div>
          ) : (
            pins.map((pin, i) => (
              <PinThread
                key={pin.id}
                pin={pin}
                pinNumber={i + 1}
                authorType="client"
                authorName={clientName}
                canResolve={false}
                onUpdate={loadPins}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
