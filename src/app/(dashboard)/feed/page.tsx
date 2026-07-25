import { redirect } from "next/navigation";

/** Feed moved under farm Quick links — keep old URL working. */
export default function FeedRedirectPage() {
  redirect("/farms");
}
