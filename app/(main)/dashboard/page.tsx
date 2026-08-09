import { redirect } from "next/navigation";

/** Legacy closet URL — product closet is `/closet`. */
export default function DashboardRedirectPage() {
  redirect("/closet");
}
