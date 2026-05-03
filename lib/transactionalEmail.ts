type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function isProductionLike(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Minimal transactional email sender.
 * Uses Resend HTTP API if configured, otherwise logs in non-production.
 */
export async function sendTransactionalEmail(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (apiKey && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`EmailDeliveryFailed:${res.status}:${body}`);
    }
    return;
  }

  if (isProductionLike()) {
    throw new Error("EmailDeliveryNotConfigured");
  }

  console.info("[email][dev]", {
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const { to, resetUrl } = params;
  await sendTransactionalEmail({
    to,
    subject: "Reset your password",
    text: `You requested a password reset.\n\nReset link: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendWorkspaceInvitationEmail(params: {
  to: string;
  workspaceName: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  inviteUrl: string;
}): Promise<void> {
  const { to, inviteUrl } = params;
  const safeHref = escapeHtmlAttr(inviteUrl);

  const subject = "You're invited to join AI Workspace";

  const text = `Hi,

You've been invited to join AI Workspace, our new internal platform for testing AI-assisted creative and workflow tools.

AI Workspace is designed to help teams explore, organize, and use AI more effectively through dedicated agents, shared knowledge, structured prompts, and controlled workspace access.

This is an early test version, so your feedback will help us improve the experience, identify issues, and shape the next version of the platform.

Please use the link below to accept your invitation and access the workspace.

Join AI Workspace:
${inviteUrl}

If you were not expecting this invitation, you can safely ignore this email.

Best,
AI Workspace Team`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.55;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px 28px;">
              <h1 style="margin:0;font-size:22px;font-weight:600;color:#18181b;letter-spacing:-0.02em;">AI Workspace Beta</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px 28px;font-size:15px;color:#3f3f46;">
              <p style="margin:0 0 16px 0;">Hi,</p>
              <p style="margin:0 0 16px 0;">You've been invited to join <strong>AI Workspace</strong>, our new internal platform for testing AI-assisted creative and workflow tools.</p>
              <p style="margin:0 0 16px 0;">AI Workspace is designed to help teams explore, organize, and use AI more effectively through dedicated agents, shared knowledge, structured prompts, and controlled workspace access.</p>
              <p style="margin:0 0 16px 0;">This is an early test version, so your feedback will help us improve the experience, identify issues, and shape the next version of the platform.</p>
              <p style="margin:0 0 24px 0;">Please use the button below to accept your invitation and access the workspace.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
                <tr>
                  <td style="border-radius:8px;background-color:#18181b;">
                    <a href="${safeHref}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Join AI Workspace</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0;font-size:13px;color:#71717a;">If you were not expecting this invitation, you can safely ignore this email.</p>
              <p style="margin:16px 0 0 0;font-size:14px;color:#3f3f46;">Best,<br />AI Workspace Team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendTransactionalEmail({
    to,
    subject,
    text,
    html,
  });
}
