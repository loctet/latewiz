"use client";

import { createAuthClient } from "better-auth/react";

/** Same-origin client — omit baseURL so requests always hit this app’s /api/auth. */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession, resetPassword } = authClient;

/** Prefer typed helper — some better-auth versions expose forgetPassword vs requestPasswordReset. */
export async function forgetPassword(opts: {
  email: string;
  redirectTo?: string;
}) {
  const client = authClient as typeof authClient & {
    forgetPassword?: (args: {
      email: string;
      redirectTo?: string;
    }) => Promise<{ error?: { message?: string } | null; data?: unknown }>;
    requestPasswordReset?: (args: {
      email: string;
      redirectTo?: string;
    }) => Promise<{ error?: { message?: string } | null; data?: unknown }>;
  };

  if (typeof client.requestPasswordReset === "function") {
    return client.requestPasswordReset(opts);
  }
  if (typeof client.forgetPassword === "function") {
    return client.forgetPassword(opts);
  }
  throw new Error("Password reset is not available in this auth client build");
}
