import { redirect } from "next/navigation";

/** Generator lives as a sheet on Today — keep this route as a deep link. */
export default function GeneratorPage() {
  redirect("/?change-look=1");
}
