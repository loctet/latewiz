import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { PageContainer } from "@/components/dashboard";
import ComposeClient from "./compose-client";

function ComposeLoading() {
  return (
    <PageContainer>
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading…
      </div>
    </PageContainer>
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={<ComposeLoading />}>
      <ComposeClient />
    </Suspense>
  );
}
