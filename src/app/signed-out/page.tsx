import { redirect } from "next/navigation";

/** Network fallback. /api/leave is skipped by the Home Screen worker. */
export default function SignedOutPage() {
  redirect("/api/leave");
}
