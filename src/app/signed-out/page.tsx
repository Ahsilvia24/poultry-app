import { redirect } from "next/navigation";

/** Network fallback. The Home Screen worker should serve /signed-out.html instead. */
export default function SignedOutPage() {
  redirect("/signed-out.html");
}
