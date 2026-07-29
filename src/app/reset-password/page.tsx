"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/logo";
import { toast } from "sonner";
import { Suspense } from "react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const linkError = useMemo(() => searchParams.get("error") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("Missing reset token. Request a new link.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      });
      const json = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        toast.error(json.error || "Could not reset password");
        return;
      }

      toast.success(json.message || "Password updated. You can sign in now.");
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  const showForm = Boolean(token) && !linkError;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="lg" />
          <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">
            Enter a new password for your account.
          </p>
        </div>

        {!showForm ? (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {linkError
                ? "This reset link is invalid or has expired."
                : "This reset link is invalid or incomplete."}
            </p>
            <Button asChild className="w-full">
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-lg border border-border bg-card p-6"
          >
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <PasswordInput
                id="confirm"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving…" : "Update password"}
            </Button>
          </form>
        )}

        {showForm && (
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
