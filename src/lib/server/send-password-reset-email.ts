import "server-only";
import { BRAND } from "@/lib/brand";

export type SendPasswordResetResult =
  | { ok: true }
  | { ok: false; message: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function friendlyResendError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      message?: string;
      name?: string;
    };
    const message = parsed.message?.trim();
    if (message) {
      if (/domain is not verified/i.test(message)) {
        return `${message} Use a verified domain in EMAIL_FROM, or for local tests use EMAIL_FROM=${BRAND.name} <onboarding@resend.dev> (can only send to your Resend account email).`;
      }
      return message;
    }
  } catch {
    /* ignore */
  }
  return raw.slice(0, 300) || "Failed to send reset email";
}

function buildPasswordResetEmail(opts: {
  url: string;
  name?: string;
}): { subject: string; html: string; text: string } {
  const brand = BRAND.name;
  const greeting = opts.name?.trim()
    ? `Hi ${opts.name.trim()},`
    : "Hi there,";
  const safeUrl = escapeHtml(opts.url);
  const safeGreeting = escapeHtml(greeting);
  const year = new Date().getFullYear();
  const accent = BRAND.colors.teal;
  const navy = BRAND.colors.navy;

  const subject = `Reset your ${brand} password`;
  const text = [
    greeting,
    "",
    `We received a request to reset the password for your ${brand} account.`,
    "",
    "Open this link to choose a new password (expires in 1 hour):",
    opts.url,
    "",
    "If you did not request a password reset, you can ignore this email. Your password will stay the same.",
    "",
    `— The ${brand} team`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1f2e;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Choose a new password for your ${escapeHtml(brand)} account. This link expires in 1 hour.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6ebf0;">
          <tr>
            <td style="background:linear-gradient(135deg,${accent} 0%,${navy} 100%);padding:28px 32px;">
              <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">${escapeHtml(brand)}</p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">${escapeHtml(BRAND.tagline)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 28px;">
              <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:700;color:#0f172a;">Reset your password</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${safeGreeting}</p>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#334155;">
                We received a request to reset the password for your ${escapeHtml(brand)} account.
                Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:8px;background-color:${accent};">
                    <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748b;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="${safeUrl}" style="color:${accent};text-decoration:underline;">${safeUrl}</a>
              </p>
              <p style="margin:0;padding-top:20px;border-top:1px solid #eef2f6;font-size:13px;line-height:1.6;color:#64748b;">
                If you did not request a password reset, you can safely ignore this email.
                Your password will remain unchanged.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;background-color:#f8fafc;border-top:1px solid #eef2f6;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                © ${year} ${escapeHtml(brand)}. ${escapeHtml(BRAND.tagline)}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

export async function sendPasswordResetEmail(opts: {
  to: string;
  url: string;
  name?: string;
}): Promise<SendPasswordResetResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.EMAIL_FROM?.trim() ||
    `${BRAND.name} <onboarding@resend.dev>`;

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
      message: `EMAIL_FROM looks invalid (contains @@). Fix it in .env, e.g. ${BRAND.name} <noreply@your-verified-domain.com>.`,
    };
  }

  const { subject, html, text } = buildPasswordResetEmail(opts);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[latewiz] Resend password-reset failed:", body);
    return { ok: false, message: friendlyResendError(body) };
  }

  return { ok: true };
}
