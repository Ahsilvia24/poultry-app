import { redirect } from "next/navigation";

/** Network fallback when the worker is not intercepting. Always leave the app. */
export default function SignedOutPage() {
  redirect("/login?signedout=1");
}
