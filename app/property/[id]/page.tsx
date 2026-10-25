import { notFound } from "next/navigation";
import Header from "@/components/Header";
import PropertyView from "@/components/PropertyView";
import { getPermit } from "@/lib/permits";
import { getScan, latestScanForPermit } from "@/lib/db";
import { nonprofits } from "@/lib/match";

export const dynamic = "force-dynamic";

export default async function PropertyPage({ params, searchParams }: {
  params: { id: string }; searchParams: { scan?: string };
}) {
  const permit = getPermit(params.id);
  if (!permit) notFound();
  const byId = searchParams.scan ? await getScan(searchParams.scan) : null;
  const scan = byId?.permitId === permit.id ? byId : await latestScanForPermit(permit.id);
  return (
    <main>
      <Header />
      <PropertyView permit={permit} initialScan={scan} nonprofits={nonprofits} />
    </main>
  );
}
