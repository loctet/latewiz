"use client";

import { NicheProfileForm } from "@/components/niche";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";

export default function NichePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          Content Niche
        </h1>
        <p className="text-muted-foreground mt-1">
          Define your audience, language, and voice. AI Studio, Compose, and
          Campaign Planner use these settings for every generation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Niche profile</CardTitle>
          <CardDescription>
            Edit your profile, then click Save to apply it to AI generation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NicheProfileForm />
        </CardContent>
      </Card>
    </div>
  );
}
