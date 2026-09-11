import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

function isNextRedirect(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const digest = "digest" in error ? String((error as { digest?: string }).digest) : "";
  const message = error instanceof Error ? error.message : "";
  return digest.includes("NEXT_REDIRECT") || message === "NEXT_REDIRECT";
}

/** Set the Auth.js session cookie without a server-action redirect. */
export async function establishWebSession(
  email: string,
  password: string,
): Promise<{ error?: string }> {
  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (typeof result === "string" && /[?&]error=/.test(result)) {
      return { error: "Invalid email or password" };
    }
    if (result && typeof result === "object" && "error" in result) {
      const err = (result as { error?: string }).error;
      if (err) return { error: "Invalid email or password" };
    }
    return {};
  } catch (error) {
    if (isNextRedirect(error)) return {};
    if (error instanceof AuthError) return { error: "Invalid email or password" };
    return { error: "Invalid email or password" };
  }
}
