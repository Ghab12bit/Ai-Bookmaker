"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ImagePlus } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { Pin, Comment } from "@/lib/types";

interface PinThreadProps {
  pin: Pin;
  pinNumber: number;
  authorType: string;
  authorName: string;
  canResolve: boolean;
  onUpdate: () => void;
}

export function PinThread({
  pin,
  pinNumber,
  authorType,
  authorName,
  canResolve,
  onUpdate,
}: PinThreadProps) {
  const [replyBody, setReplyBody] = useState("");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const supabase = createClient();

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSending(true);

    let referenceUrl: string | null = null;
    if (refFile) {
      const path = `${crypto.randomUUID()}.${refFile.name.split(".").pop()}`;
      const { error } = await supabase.storage
        .from("references")
        .upload(path, refFile);
      if (!error) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("references").getPublicUrl(path);
        referenceUrl = publicUrl;
      }
    }

    await supabase.from("comments").insert({
      pin_id: pin.id,
      author_type: authorType,
      author_name: authorName,
      body: replyBody,
      reference_url: referenceUrl,
    });

    setReplyBody("");
    setRefFile(null);
    setSending(false);
    onUpdate();
  }

  async function handleResolve() {
    await supabase
      .from("pins")
      .update({ resolved: !pin.resolved })
      .eq("id", pin.id);
    onUpdate();
  }

  const comments = pin.comments || [];

  return (
    <div className="border-b border-neutral-100 last:border-0">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-neutral-800 text-white text-[10px] font-bold flex items-center justify-center">
              {pinNumber}
            </span>
            <span className="text-sm font-medium text-neutral-900">
              {pin.author_name}
            </span>
            <span className="text-xs text-neutral-400">
              {timeAgo(pin.created_at)}
            </span>
          </div>
          {canResolve && (
            <button
              onClick={handleResolve}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                pin.resolved
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              }`}
            >
              <Check className="h-3 w-3 inline mr-1" />
              {pin.resolved ? "Resolved" : "Resolve"}
            </button>
          )}
        </div>

        <div className="mt-2 space-y-2">
          {comments.map((comment: Comment) => (
            <div key={comment.id} className="pl-7">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-neutral-700">
                  {comment.author_name}
                </span>
                <span className="text-xs text-neutral-400">
                  {timeAgo(comment.created_at)}
                </span>
              </div>
              <p className="text-sm text-neutral-600 mt-0.5">{comment.body}</p>
              {comment.reference_url && (
                <a
                  href={comment.reference_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={comment.reference_url}
                    alt="Reference"
                    className="max-w-[200px] max-h-[120px] rounded-md border border-neutral-200 object-cover"
                  />
                </a>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleReply} className="mt-3 pl-7 flex gap-2">
          <div className="flex-1 flex gap-2">
            <Input
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Reply…"
              className="h-8 text-sm"
            />
            <label className="cursor-pointer flex items-center">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setRefFile(e.target.files?.[0] || null)}
              />
              <ImagePlus className="h-4 w-4 text-neutral-400 hover:text-neutral-600" />
            </label>
          </div>
          <Button type="submit" size="sm" disabled={!replyBody.trim() || sending}>
            Send
          </Button>
        </form>
        {refFile && (
          <p className="text-xs text-neutral-400 pl-7 mt-1">
            📎 {refFile.name}
          </p>
        )}
      </div>
    </div>
  );
}
