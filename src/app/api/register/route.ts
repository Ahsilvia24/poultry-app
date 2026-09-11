import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isRegisterEmailAllowed } from "@/lib/allowedRegisterEmails";
import { registerSchema } from "@/lib/validations";
import { establishWebSession } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  if (!isRegisterEmailAllowed(email)) {
    return NextResponse.json({ error: "This email is not approved for an account." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      settings: { create: {} },
    },
  });

  const signedIn = await establishWebSession(email, parsed.data.password);
  if (signedIn.error) {
    return NextResponse.json({ error: "Account created. Sign in with your email." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
