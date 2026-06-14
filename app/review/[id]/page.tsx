"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PinDot } from "@/components/canvas/pin-dot";
import { PinThread } from "@/components/canvas/pin-thread";
import {
  ArrowLeft,
  Upload,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react";
import { timeRemaining } from "@/lib/utils";
import type { Profile, Review, Version, Pin } from "@/lib/types";

export default function ReviewCanvasPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const imageRef = useRef<HTMLDivElement>(null);

  const [review, setReview] = useState<Review | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersion, setCurrentVersion] = useState<Version | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [copied, setCopied] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const loadReview = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile(profileData);

    const { data: reviewData } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", id)
      .single();
    setReview(reviewData);

    const { data: versionsData } = await supabase
      .from("versions")
      .select("*")
      .eq("review_id", id)
      .order("version_number", { ascending: true });
    setVersions(versionsData || []);

    if (versionsData && versionsData.length > 0) {
      const latest = versionsData[versionsData.length - 1];
      setCurrentVersion((prev) => prev || latest);
    }
    setLoading(false);
  }, [supabase, id]);

  const loadPins = useCallback(async () => {
    if (!currentVersion) return;
    const { data: pinsData } = await supabase
      .from("pins")
      .select("*, comments(*)")
      .eq("version_id", currentVersion.id)
      .order("created_at", { ascending: true });
    setPins(pinsData || []);
  }, [supabase, currentVersion]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  // Realtime subscription for pins
  useEffect(() => {
    if (!currentVersion) return;
    const channel = supabase
      .channel(`pins-${currentVersion.id}`)
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
        {
          event: "*",
          schema: "public",
          table: "comments",
        },
        () => loadPins()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentVersion, loadPins]);

  async function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!currentVersion || !profile || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const { data: pin } = await supabase
      .from("pins")
      .insert({
        version_id: currentVersion.id,
        x_pct: Math.round(x * 100) / 100,
        y_pct: Math.round(y * 100) / 100,
        author_type: profile.role,
        author_name: profile.name,
      })
      .select()
      .single();

    if (pin) {
      setActivePin(pin.id);
      loadPins();
    }
  }

  async function handleVersionUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !review) return;
    setUploadingVersion(true);

    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("designs")
      .upload(path, file);

    if (error) {
      alert("Upload failed");
      setUploadingVersion(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("designs").getPublicUrl(path);

    const nextNum = versions.length + 1;
    const { data: version } = await supabase
      .from("versions")
      .insert({
        review_id: review.id,
        version_number: nextNum,
        file_url: publicUrl,
        file_type: file.type.startsWith("image/") ? "image" : "pdf",
      })
      .select()
      .single();

    if (version) {
      setVersions((prev) => [...prev, version]);
      setCurrentVersion(version);
      setActivePin(null);
    }
    setUploadingVersion(false);
  }

  async function handleReadyForClient() {
    if (!review) return;
    const updates: Record<string, unknown> = {
      stage: "client",
      client_link_active: true,
    };
    if (deadline) {
      updates.feedback_deadline = new Date(deadline).toISOString();
    }
    await supabase.from("reviews").update(updates).eq("id", review.id);
    setShowClientDialog(false);
    loadReview();
  }

  async function handleStatusChange(
    status: "in_review" | "changes_requested" | "approved"
  ) {
    if (!review) return;
    await supabase.from("reviews").update({ status }).eq("id", review.id);
    setReview({ ...review, status });
    setShowStatusMenu(false);
  }

  function copyClientLink() {
    if (!review) return;
    const url = `${window.location.origin}/r/${review.client_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !review) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400 text-sm">Loading…</p>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    in_review: "In Review",
    changes_requested: "Changes Requested",
    approved: "Approved",
  };

  return (
    <div className="h-screen flex flex-col bg-neutral-50">
      {/* Top bar */}
      <header className="border-b border-neutral-200 bg-white px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-sm font-semibold text-neutral-900">
            {review.title}
          </h1>
          <span className="text-xs text-neutral-400">{review.client_name}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Version selector */}
          <div className="relative">
            <button
              onClick={() => setShowVersionMenu(!showVersionMenu)}
              className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 bg-neutral-100 px-2.5 py-1 rounded-md"
            >
              v{currentVersion?.version_number || 1}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showVersionMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-neutral-200 rounded-md shadow-lg py-1 z-20 min-w-[120px]">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setCurrentVersion(v);
                      setActivePin(null);
                      setShowVersionMenu(false);
                    }}
                    className={`block w-full text-left px-3 py-1.5 text-sm ${
                      v.id === currentVersion?.id
                        ? "bg-neutral-100 font-medium"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    Version {v.version_number}
                  </button>
                ))}
                <hr className="my-1 border-neutral-100" />
                <label className="block px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 cursor-pointer">
                  <Upload className="h-3 w-3 inline mr-1.5" />
                  {uploadingVersion ? "Uploading…" : "Upload new version"}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleVersionUpload}
                    disabled={uploadingVersion}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Stage + status */}
          <Badge variant="secondary" className="capitalize">
            {review.stage}
          </Badge>

          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="flex items-center gap-1"
            >
              <Badge
                variant={
                  review.status === "approved"
                    ? "success"
                    : review.status === "changes_requested"
                    ? "destructive"
                    : "warning"
                }
              >
                {statusLabels[review.status]}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Badge>
            </button>
            {showStatusMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-neutral-200 rounded-md shadow-lg py-1 z-20 min-w-[160px]">
                {(
                  ["in_review", "changes_requested", "approved"] as const
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`block w-full text-left px-3 py-1.5 text-sm ${
                      review.status === s
                        ? "bg-neutral-100 font-medium"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ready for client */}
          {review.stage === "internal" && (
            <Button size="sm" onClick={() => setShowClientDialog(true)}>
              Ready for Client
            </Button>
          )}

          {/* Client link (when active) */}
          {review.client_link_active && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyClientLink}
            >
              {copied ? (
                <Check className="h-3 w-3 mr-1.5" />
              ) : (
                <Copy className="h-3 w-3 mr-1.5" />
              )}
              {copied ? "Copied!" : "Client link"}
            </Button>
          )}

          {review.feedback_deadline && (
            <span className="text-xs text-neutral-500">
              {timeRemaining(review.feedback_deadline)}
            </span>
          )}
        </div>
      </header>

      {/* Canvas + panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
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
            <div className="text-center text-neutral-500 text-sm">
              <p>PDF preview</p>
              <iframe
                src={currentVersion.file_url}
                className="w-full h-[calc(100vh-200px)] border-0 mt-4"
                title="PDF"
              />
            </div>
          ) : (
            <p className="text-neutral-400 text-sm">No design uploaded</p>
          )}
        </div>

        {/* Right panel */}
        <div className="w-80 border-l border-neutral-200 bg-white overflow-y-auto flex-shrink-0">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-900">
              Feedback ({pins.filter((p) => !p.resolved).length} open)
            </h2>
          </div>
          {pins.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-neutral-400">
                Click on the design to drop a pin
              </p>
            </div>
          ) : (
            pins.map((pin, i) => (
              <PinThread
                key={pin.id}
                pin={pin}
                pinNumber={i + 1}
                authorType={profile?.role || "designer"}
                authorName={profile?.name || "Team"}
                canResolve={true}
                onUpdate={loadPins}
              />
            ))
          )}
        </div>
      </div>

      {/* Ready for Client dialog */}
      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share with client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-neutral-600">
              This will move the review to the client stage. The client will be
              able to view the design and leave feedback using the link below.
            </p>
            <div className="bg-neutral-50 rounded-md p-3 text-sm text-neutral-700 font-mono break-all">
              {typeof window !== "undefined" &&
                `${window.location.origin}/r/${review.client_token}`}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Feedback deadline (optional)
              </label>
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <Button onClick={handleReadyForClient} className="w-full">
              Move to client stage
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
