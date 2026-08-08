import { redirect } from "next/navigation";

/** Closet lives at `/dashboard` (post-login home). Keep `/closet` as an alias. */
export default function ClosetPage() {
  redirect("/dashboard");
}
