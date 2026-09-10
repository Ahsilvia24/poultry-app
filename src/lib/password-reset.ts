import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { createResetToken, hashResetToken } from "@/lib/password-reset-token";
import { prisma } from "@/lib/prisma";

const RESET_HOURS = 1;

export async function requestOriginFromHeaders() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  if (!host) return "";
  return `${proto}://${host}`;
}

export async function issuePasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, name: true },
  });
  if (!user) return { sent: true };

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  const token = createResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(Date.now() + RESET_HOURS * 60 * 60 * 1000),
    },
  });

  const origin = await requestOriginFromHeaders();
  const resetUrl = `${origin}/reset-password?token=${token}`;
  await sendResetEmail({ to: user.email, name: user.name, resetUrl });
  return { sent: true };
}

export async function consumePasswordReset(token: string, newPassword: string) {
  if (!token || token.length < 20) return { error: "This reset link is invalid or expired." };
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) {
    return { error: "This reset link is invalid or expired." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
  ]);
  return { ok: true };
}

async function sendResetEmail(input: { to: string; name: string; resetUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "PoultryTech <onboarding@resend.dev>";
  const text = [
    `Hi ${input.name},`,
    "",
    "Use this link to set a new PoultryTech password. It expires in 1 hour.",
    input.resetUrl,
    "",
    "If you did not ask for this, you can ignore this email.",
  ].join("\n");

  if (!apiKey) {
    console.error("RESEND_API_KEY is not set. Password reset email was not sent.");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: "Reset your PoultryTech password",
      text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("Resend email failed", res.status, body);
  }
}
