"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRegisterEmailAllowed } from "@/lib/allowedRegisterEmails";
import { issuePasswordReset, consumePasswordReset } from "@/lib/password-reset";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations";

async function signInOnThisHost(email: string, password: string) {
  const result = await signIn("credentials", {
    email,
    password,
    redirect: false,
  });
  if (result && "error" in result && result.error) {
    return { error: "Invalid email or password" };
  }
  return null;
}

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase();
  if (!isRegisterEmailAllowed(email)) {
    return { error: "This email is not approved for an account." };
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      settings: { create: {} },
    },
  });

  try {
    const failed = await signInOnThisHost(email, parsed.data.password);
    if (failed) return failed;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created. Sign in with your email." };
    }
    throw error;
  }
  redirect("/");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");
  try {
    const failed = await signInOnThisHost(email, password);
    if (failed) return failed;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw error;
  }
  redirect("/");
}

export async function signOutAction() {
  await signOut({ redirect: false });
  redirect("/login");
}

export async function forgotPasswordAction(formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email" };
  }
  await issuePasswordReset(parsed.data.email);
  return { sent: true };
}

export async function changePasswordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to change your password." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) return { error: "Sign in to change your password." };

  const matches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!matches) return { error: "Current password is incorrect." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash },
  });
  return { ok: true };
}

export async function resetPasswordAction(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const result = await consumePasswordReset(parsed.data.token, parsed.data.password);
  if (result.error) return { error: result.error };
  redirect("/login?reset=1");
}
