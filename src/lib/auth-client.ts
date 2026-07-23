"use client";

import { createAuthClient } from "better-auth/react";

/** Same-origin client — omit baseURL so requests always hit this app’s /api/auth. */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
