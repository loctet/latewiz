import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { authSchema } from "@/db/schema";

function authFallbackUrl(): string {
  return (
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}

function envOriginList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return value.replace(/\/$/, "");
      }
    });
}

/**
 * Always trust local dev + configured public URLs so signup/login works when
 * NEXT_PUBLIC_APP_URL is production (latewiz.com) but you run on localhost.
 */
function trustedOrigins(): string[] {
  const origins = new Set<string>([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "https://latewiz.com",
    "https://www.latewiz.com",
    ...envOriginList(process.env.BETTER_AUTH_URL),
    ...envOriginList(process.env.NEXT_PUBLIC_APP_URL),
    ...envOriginList(process.env.BETTER_AUTH_TRUSTED_ORIGINS),
  ]);
  return [...origins];
}

async function sendPasswordResetEmail(opts: {
  to: string;
  url: string;
  name?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.EMAIL_FROM?.trim() || "LateWiz <onboarding@resend.dev>";

  if (!apiKey) {
    console.error(
      "[latewiz] Password reset requested but RESEND_API_KEY is not set.",
      "Reset URL (dev only):",
      opts.url
    );
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    throw new Error(
      "Password reset email is not configured. Set RESEND_API_KEY and EMAIL_FROM."
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: "Reset your LateWiz password",
      html: `
        <p>Hi${opts.name ? ` ${opts.name}` : ""},</p>
        <p>Click the link below to reset your LateWiz password:</p>
        <p><a href="${opts.url}">${opts.url}</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send reset email: ${text}`);
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: authSchema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  // Dynamic base URL: resolve from the request host when it is allowed.
  baseURL: {
    allowedHosts: [
      "localhost:*",
      "127.0.0.1:*",
      "latewiz.com",
      "www.latewiz.com",
      "*.vercel.app",
      ...(process.env.BETTER_AUTH_ALLOWED_HOSTS?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? []),
    ],
    fallback: authFallbackUrl(),
    protocol: "auto",
  },
  trustedOrigins: trustedOrigins(),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        to: user.email,
        url,
        name: user.name,
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60,
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
