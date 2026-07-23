"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { useState, useEffect } from "react";
import { SessionBootstrap } from "@/components/session-bootstrap";

function pruneOversizedAiStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("latewiz-ai");
    if (!raw || raw.length < 400_000) return;
    const parsed = JSON.parse(raw) as {
      state?: Record<string, unknown>;
    };
    const state = (parsed.state ?? parsed) as Record<string, unknown>;
    if (state && typeof state === "object") {
      delete state.generatedMedia;
      localStorage.setItem(
        "latewiz-ai",
        JSON.stringify({ ...parsed, state })
      );
    }
  } catch {
    try {
      localStorage.removeItem("latewiz-ai");
    } catch {
      /* ignore */
    }
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    pruneOversizedAiStorage();
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <SessionBootstrap>{children}</SessionBootstrap>
        <Toaster position="top-right" richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
