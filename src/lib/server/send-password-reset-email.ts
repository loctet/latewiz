import "server-only";

export type SendPasswordResetResult =
  | { ok: true }
  | { ok: false; message: string };

function friendlyResendError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      message?: string;
      name?: string;
    };
    const message = parsed.message?.trim();
    if (message) {
      if (/domain is not verified/i.test(message)) {
        return `${message} Use a verified domain in EMAIL_FROM, or for local tests use EMAIL_FROM=LateWiz <onboarding@resend.dev> (can only send to your Resend account email).`;
      }
      return message;
    }
  } catch {
    /* ignore */
  }
  return raw.slice(0, 300) || "Failed to send reset email";
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  url: string;
  name?: string;
}): Promise<SendPasswordResetResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.EMAIL_FROM?.trim() || "LateWiz <onboarding@resend.dev>";

  if (!apiKey || apiKey.includes("...")) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[latewiz] RESEND_API_KEY missing. Reset URL (dev only):",
        opts.url
      );
      return {
        ok: false,
        message:
          "Password reset email is not configured. Set RESEND_API_KEY and EMAIL_FROM in .env.",
      };
    }
    return {
      ok: false,
      message:
        "Password reset email is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
    };
  }

  if (from.includes("@@")) {
    return {
      ok: false,
      message:
        "EMAIL_FROM looks invalid (contains @@). Fix it in .env, e.g. LateWiz <noreply@your-verified-domain.com>.",
    };
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
    console.error("[latewiz] Resend password-reset failed:", text);
    return { ok: false, message: friendlyResendError(text) };
  }

  return { ok: true };
}
