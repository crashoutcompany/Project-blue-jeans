import { redirect } from "next/navigation";

export default function NotAdminPage() {
  redirect("/auth/not-admitted");
}
