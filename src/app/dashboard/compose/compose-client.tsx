"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  useCreatePost,
  useUpdatePost,
  usePost,
  useAccounts,
  useCurrentProfileId,
  useUploadMedia,
  urlToFile,
  type UploadedMedia,
} from "@/hooks";
import { useAppStore } from "@/stores";
import { AiAssistPanel } from "@/components/ai";
import { PageContainer } from "@/components/dashboard";
import { readPostPrefill, clearPostPrefill } from "@/lib/post-prefill";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PlatformSelector } from "./_components/platform-selector";
import { MediaUploader } from "./_components/media-uploader";
import { SchedulePicker, type ScheduleType } from "./_components/schedule-picker";
import { Loader2, Send, PenSquare, Users, Calendar, Image as ImageIcon } from "lucide-react";
import type { Platform } from "@/lib/late-api";

function mediaItemsToUploaded(
  items: Array<{ type: "image" | "video"; url: string }> | undefined
): UploadedMedia[] {
  if (!items?.length) return [];
  return items.map((item, i) => {
    const ext = item.type === "video" ? "mp4" : "jpg";
    return {
      url: item.url,
      type: item.type,
      filename: `existing-${i + 1}.${ext}`,
      contentType: item.type === "video" ? "video/mp4" : "image/jpeg",
    };
  });
}

export default function ComposeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editPostId = searchParams.get("edit");
  const isEditing = Boolean(editPostId);

  const { timezone } = useAppStore();
  const profileId = useCurrentProfileId();
  const { data: accountsData } = useAccounts();
  const createPostMutation = useCreatePost();
  const updatePostMutation = useUpdatePost();
  const uploadMutation = useUploadMedia();
  const {
    data: editPostData,
    isLoading: isLoadingEditPost,
    isError: isEditPostError,
  } = usePost(editPostId ?? "");

  // Form state
  const [content, setContent] = useState("");
  const [aiHint, setAiHint] = useState<string | undefined>();
  const [media, setMedia] = useState<UploadedMedia[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [scheduleType, setScheduleType] = useState<ScheduleType>("now");
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const editHydratedRef = useRef<string | null>(null);

  const accounts = (accountsData?.accounts || []) as any[];
  const hasVideo = media.some((m) => m.type === "video");
  const hasImages = media.some((m) => m.type === "image");

  // Get selected accounts with platform info
  const selectedAccounts = accounts.filter((a) =>
    selectedAccountIds.includes(a._id)
  );

  const charCount = content.length;
  const charLimit = 5000;
  const isSaving =
    createPostMutation.isPending || updatePostMutation.isPending;

  useEffect(() => {
    if (isEditing) return;
    const prefill = readPostPrefill();
    if (!prefill) return;
    clearPostPrefill();
    if (prefill.body) setContent(prefill.body);
    if (prefill.aiHint) setAiHint(prefill.aiHint);
    if (prefill.imageUrls?.length || prefill.videoUrls?.length) {
      (async () => {
        const uploaded: UploadedMedia[] = [];
        for (const url of prefill.imageUrls ?? []) {
          try {
            const file = await urlToFile(url);
            const item = await uploadMutation.mutateAsync(file);
            uploaded.push(item);
          } catch {
            toast.error("Could not attach prefilled image");
          }
        }
        for (const url of prefill.videoUrls ?? []) {
          try {
            const file = await urlToFile(url, "ai-video.mp4");
            const item = await uploadMutation.mutateAsync(file);
            uploaded.push(item);
          } catch {
            toast.error("Could not attach prefilled video");
          }
        }
        if (uploaded.length) {
          setMedia((m) => [...m, ...uploaded]);
        }
      })();
    }
    // Run once when opening composer with session prefill
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  useEffect(() => {
    if (!editPostId) {
      editHydratedRef.current = null;
    }
  }, [editPostId]);

  useEffect(() => {
    if (!isEditing || !editPostId) return;
    if (isEditPostError) {
      toast.error("Could not load post to edit");
      router.replace("/dashboard/compose");
      return;
    }

    const post = (editPostData as { post?: { _id?: string; content?: string; mediaItems?: Array<{ type: "image" | "video"; url: string }>; platforms?: Array<{ accountId?: string }>; scheduledFor?: string } } | null | undefined)?.post;
    if (!post?._id || post._id !== editPostId) return;
    if (editHydratedRef.current === editPostId) return;
    editHydratedRef.current = editPostId;

    setContent(post.content ?? "");
    setMedia(mediaItemsToUploaded(post.mediaItems));
    setSelectedAccountIds(
      (post.platforms ?? [])
        .map((p) => p.accountId)
        .filter((id): id is string => Boolean(id))
    );

    if (post.scheduledFor) {
      const when = new Date(post.scheduledFor);
      setScheduleType("scheduled");
      setScheduledDate(when);
      setScheduledTime(
        `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`
      );
    } else {
      setScheduleType("now");
    }
  }, [isEditing, editPostId, editPostData, isEditPostError, router]);

  const canSubmit =
    selectedAccountIds.length > 0 &&
    (content.trim() || media.length > 0) &&
    !isSaving &&
    !(isEditing && isLoadingEditPost);

  const handleSubmit = async () => {
    if (!canSubmit || !profileId) return;

    try {
      let scheduledFor: string | undefined;
      if (scheduleType === "scheduled" && scheduledDate) {
        const [hours, minutes] = scheduledTime.split(":").map(Number);
        const scheduled = new Date(scheduledDate);
        scheduled.setHours(hours, minutes, 0, 0);
        scheduledFor = scheduled.toISOString();
      } else if (isEditing && scheduleType === "now") {
        scheduledFor = new Date().toISOString();
      }

      const platforms = selectedAccounts.map((account) => ({
        platform: account.platform as Platform,
        accountId: account._id,
      }));

      const mediaItems = media.map((m) => ({
        type: m.type,
        url: m.url,
      }));

      if (isEditing && editPostId) {
        await updatePostMutation.mutateAsync({
          postId: editPostId,
          content,
          mediaItems: mediaItems.length > 0 ? mediaItems : [],
          platforms,
          scheduledFor,
        });
        toast.success(
          scheduleType === "now" ? "Post updated and set to publish" : "Post updated"
        );
      } else {
        await createPostMutation.mutateAsync({
          content,
          mediaItems: mediaItems.length > 0 ? mediaItems : undefined,
          platforms,
          publishNow: scheduleType === "now",
          scheduledFor,
          timezone,
          queuedFromProfile: scheduleType === "queue" ? profileId : undefined,
        });

        toast.success(
          scheduleType === "now"
            ? "Post published!"
            : scheduleType === "queue"
            ? "Post added to queue!"
            : "Post scheduled!"
        );
      }

      router.push("/dashboard/calendar");
    } catch {
      toast.error(
        isEditing
          ? "Failed to update post. Please try again."
          : "Failed to create post. Please try again."
      );
    }
  };

  if (isEditing && isLoadingEditPost) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading post…
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Page header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">
          {isEditing ? "Edit Post" : "Create Post"}
        </h1>
        <p className="text-muted-foreground">
          {isEditing
            ? "Update content, accounts, or schedule."
            : "Compose and schedule your content."}
        </p>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PenSquare className="h-4 w-4" />
            Content
          </CardTitle>
          <CardDescription>
            Write your post content and add media.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <div className="flex justify-end">
              <span
                className={`text-xs ${
                  charCount > charLimit
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {charCount} / {charLimit}
              </span>
            </div>
          </div>

          <AiAssistPanel
            content={content}
            onContentChange={setContent}
            media={media}
            onMediaChange={setMedia}
            hint={aiHint}
          />

          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Media</span>
            </div>
            <MediaUploader media={media} onMediaChange={setMedia} />
          </div>
        </CardContent>
      </Card>

      {/* Accounts + schedule */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Accounts
              {selectedAccountIds.length > 0 && (
                <span className="text-muted-foreground font-normal">
                  ({selectedAccountIds.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <PlatformSelector
              selectedAccountIds={selectedAccountIds}
              onSelectionChange={setSelectedAccountIds}
              hasVideo={hasVideo}
              hasImages={hasImages}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              When to Post
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <SchedulePicker
              scheduleType={scheduleType}
              scheduledDate={scheduledDate}
              scheduledTime={scheduledTime}
              onScheduleTypeChange={setScheduleType}
              onDateChange={setScheduledDate}
              onTimeChange={setScheduledTime}
              allowQueue={!isEditing}
            />
          </CardContent>
        </Card>
      </div>

      {/* Submit */}
      <Card>
        <CardContent className="pt-6">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
            size="lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? "Saving..." : "Creating..."}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {isEditing
                  ? scheduleType === "now"
                    ? "Save & Publish"
                    : "Save Changes"
                  : scheduleType === "now"
                  ? "Publish Now"
                  : scheduleType === "queue"
                  ? "Add to Queue"
                  : "Schedule Post"}
              </>
            )}
          </Button>

          {selectedAccountIds.length === 0 && (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Select at least one account to post
            </p>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
