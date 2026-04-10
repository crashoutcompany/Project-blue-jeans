import { GeneratorView } from "@/components/outfit/generator-view";
import { getClosetGarmentsCached } from "@/lib/garments/get-closet-garments-cached";

export default async function GeneratorPage() {
  const closetGarments = await getClosetGarmentsCached();
  return <GeneratorView closetGarments={closetGarments} />;
}
