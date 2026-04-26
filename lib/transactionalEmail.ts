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

export async function sendWorkspaceInvitationEmail(params: {
  to: string;
  workspaceName: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  inviteUrl: string;
}): Promise<void> {
  const { to, workspaceName, role, inviteUrl } = params;
  await sendTransactionalEmail({
    to,
    subject: `You are invited to join ${workspaceName}`,
    text: `You were invited to join ${workspaceName} as ${role}.\n\nAccept invitation: ${inviteUrl}\n\nIf you were not expecting this, you can ignore this email.`,
    html: `<p>You were invited to join <strong>${workspaceName}</strong> as <strong>${role}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>If you were not expecting this, you can ignore this email.</p>`,
  });
}
