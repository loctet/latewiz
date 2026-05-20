"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useGenerateDraft,
  useGenerateImage,
  useOpenAiStatus,
} from "@/hooks";
import { savePostPrefill } from "@/lib/post-prefill";
import { NOTEBOOK_INFOGRAPHIC_TOPIC_PRESETS } from "@/lib/notebook-infographic-presets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Wand2,
  Copy,
  RefreshCw,
  Image as ImageIcon,
  Hash,
  Loader2,
  PenLine,
} from "lucide-react";
import Link from "next/link";

export default function AiStudioPage() {
  const router = useRouter();
  const { data: status } = useOpenAiStatus();
  const draftMutation = useGenerateDraft();
  const imageMutation = useGenerateImage();

  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [generatedBody, setGeneratedBody] = useState("");
  const [generatedHashtags, setGeneratedHashtags] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const configured = status?.openai_configured ?? false;

  const infographicPresetValue = useMemo(() => {
    const m = NOTEBOOK_INFOGRAPHIC_TOPIC_PRESETS.find(
      (p) => p.topic === topic.trim()
    );
    return m?.id ?? "__none__";
  }, [topic]);

  const hintPayload = [topic.trim(), tone ? `Tone: ${tone}` : ""]
    .filter(Boolean)
    .join("\n");

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic or brief");
      return;
    }
    try {
      const r = await draftMutation.mutateAsync(hintPayload);
      setGeneratedTitle(r.draft.title);
      setGeneratedBody(r.draft.body);
      setGeneratedHashtags(r.draft.hashtags);
      if (r.source === "stub") {
        toast.message("Using placeholder — add OpenAI key in Settings.");
      }
      if (r.source === "fallback" && r.detail) {
        toast.error(r.detail);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    }
  };

  const handleGenerateImage = async () => {
    if (!configured) {
      toast.error("Add your OpenAI API key in Settings first.");
      return;
    }
    try {
      const caption_context = [generatedTitle.trim(), generatedBody.trim()]
        .filter(Boolean)
        .join("\n\n");
      const r = await imageMutation.mutateAsync({
        prompt: topic.trim() || undefined,
        captionContext: caption_context || undefined,
      });
      if (r.image_url) {
        setImageUrl(r.image_url);
        toast.success("Image ready — saved to your media library.");
      } else {
        toast.error(r.detail ?? "No image returned");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Image generation failed");
    }
  };

  const copyAll = async () => {
    const text = [generatedTitle, generatedBody, generatedHashtags]
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  const openInComposer = () => {
    savePostPrefill({
      title: generatedTitle,
      body: [generatedBody, generatedHashtags].filter(Boolean).join("\n\n"),
      aiHint: hintPayload,
      imageUrls: imageUrl.trim() ? [imageUrl.trim()] : undefined,
    });
    router.push("/dashboard/compose");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Content Studio
        </h1>
        <p className="text-muted-foreground mt-1">
          Draft captions and notebook-style infographics, then open in the
          composer to schedule via{" "}
          <a
            href="https://docs.zernio.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Zernio
          </a>
          .
        </p>
      </div>

      {!configured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          OpenAI is not configured.{" "}
          <Link href="/dashboard/settings" className="underline font-medium">
            Add your API key in Settings
          </Link>
          {" · "}
          <Link href="/dashboard/niche" className="underline font-medium">
            Configure content niche
          </Link>{" "}
          to enable real AI generation.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Topic & tone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Topic or brief</Label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What should this post be about?"
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Infographic preset</Label>
              <Select
                value={infographicPresetValue}
                onValueChange={(id) => {
                  if (id === "__none__") return;
                  const p = NOTEBOOK_INFOGRAPHIC_TOPIC_PRESETS.find(
                    (x) => x.id === id
                  );
                  if (p) setTopic(p.topic);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Custom topic</SelectItem>
                  {NOTEBOOK_INFOGRAPHIC_TOPIC_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="witty">Witty</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={draftMutation.isPending}>
            {draftMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Generate caption
          </Button>
        </CardContent>
      </Card>

      {(generatedBody || generatedTitle) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Generated copy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {generatedTitle && (
              <Input value={generatedTitle} readOnly className="font-medium" />
            )}
            <Textarea value={generatedBody} readOnly rows={6} />
            {generatedHashtags && (
              <p className="text-sm text-muted-foreground">{generatedHashtags}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyAll}>
                <Copy className="mr-2 h-3 w-3" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={draftMutation.isPending}
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Regenerate
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerateImage}
                disabled={imageMutation.isPending || !configured}
              >
                {imageMutation.isPending ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <ImageIcon className="mr-2 h-3 w-3" />
                )}
                Generate infographic
              </Button>
              <Button size="sm" onClick={openInComposer}>
                <PenLine className="mr-2 h-3 w-3" />
                Open in composer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {imageUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generated image</CardTitle>
          </CardHeader>
          <CardContent>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="AI generated"
              className="max-h-96 w-full rounded-lg object-contain bg-muted"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
