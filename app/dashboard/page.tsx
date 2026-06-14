"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, LogOut } from "lucide-react";
import { generateToken, timeAgo } from "@/lib/utils";
import type { Profile, ReviewWithVersion } from "@/lib/types";

type FilterStatus = "all" | "in_review" | "changes_requested" | "approved";

const statusConfig: Record<
  string,
  { label: string; variant: "warning" | "destructive" | "success" }
> = {
  in_review: { label: "In Review", variant: "warning" },
  changes_requested: { label: "Changes Requested", variant: "destructive" },
  approved: { label: "Approved", variant: "success" },
};

export default function DashboardPage() {
  const [reviews, setReviews] = useState<ReviewWithVersion[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    setProfile(profileData);

    const { data: reviewsData } = await supabase
      .from("reviews")
      .select("*, versions(*)")
      .order("created_at", { ascending: false });

    setReviews((reviewsData as ReviewWithVersion[]) || []);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !profile) return;
    setCreating(true);

    const fileExt = file.name.split(".").pop();
    const filePath = `${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("designs")
      .upload(filePath, file);

    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setCreating(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("designs").getPublicUrl(filePath);

    const token = generateToken();
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .insert({
        title,
        client_name: clientName,
        client_token: token,
        created_by: profile.id,
      })
      .select()
      .single();

    if (reviewError || !review) {
      alert("Failed to create review: " + (reviewError?.message || "Unknown"));
      setCreating(false);
      return;
    }

    const isImage = file.type.startsWith("image/");
    await supabase.from("versions").insert({
      review_id: review.id,
      version_number: 1,
      file_url: publicUrl,
      file_type: isImage ? "image" : "pdf",
    });

    setDialogOpen(false);
    setTitle("");
    setClientName("");
    setFile(null);
    setCreating(false);
    router.push(`/review/${review.id}`);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const filtered =
    filter === "all" ? reviews : reviews.filter((r) => r.status === filter);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-neutral-900">
            AdClear Review
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-500">{profile?.name}</span>
            <Badge variant="secondary">{profile?.role === "am" ? "Account Manager" : "Designer"}</Badge>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {(["all", "in_review", "changes_requested", "approved"] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === s
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {s === "all"
                    ? "All"
                    : statusConfig[s]?.label || s}
                </button>
              )
            )}
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> New review
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create new review</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Title
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. HDFC Sky — Diwali Banner"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Client name
                  </label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. HDFC Bank"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Design file
                  </label>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Creating…" : "Create review"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-neutral-400 text-sm">
              {reviews.length === 0
                ? "No reviews yet — create your first"
                : "No reviews match this filter"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((review) => {
              const latestVersion = review.versions?.sort(
                (a, b) => b.version_number - a.version_number
              )[0];
              const sc = statusConfig[review.status];
              return (
                <button
                  key={review.id}
                  onClick={() => router.push(`/review/${review.id}`)}
                  className="flex items-center gap-4 bg-white rounded-lg border border-neutral-200 p-4 hover:border-neutral-300 transition-colors text-left w-full"
                >
                  {latestVersion?.file_type === "image" && (
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-neutral-100 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={latestVersion.file_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-neutral-900 truncate">
                        {review.title}
                      </h3>
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-neutral-500">
                      <span>{review.client_name}</span>
                      <span>·</span>
                      <span>
                        v{latestVersion?.version_number || 1}
                      </span>
                      <span>·</span>
                      <span className="capitalize">{review.stage}</span>
                      <span>·</span>
                      <span>{timeAgo(review.created_at)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
