import Header from "@/components/Header";
import RadarView from "@/components/RadarView";
import { getPermits } from "@/lib/permits";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="flex flex-col md:h-screen">
      <Header />
      <RadarView permits={getPermits()} />
    </main>
  );
}
