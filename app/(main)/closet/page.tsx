import { getClosetGarmentsCached } from "@/lib/garments/get-closet-garments-cached";
import { ClosetView } from "@/components/outfit/closet-view";

export default async function ClosetPage() {
  const garments = await getClosetGarmentsCached();

  return <ClosetView initialGarments={garments} />;
}
