export const SHOW_CO2 = process.env.NEXT_PUBLIC_SHOW_CO2 !== "false";

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const tons = (lb: number) => (lb / 2000).toFixed(2);
export const num = (n: number) => Math.round(n).toLocaleString("en-US");

export function daysSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso + "T12:00:00").getTime()) / 86_400_000));
}

export type Urgency = { key: "now" | "soon" | "late"; label: string; color: string };
export function urgency(iso: string): Urgency {
  const d = daysSince(iso);
  if (d <= 14) return { key: "now", label: "Issued ≤ 14 days ago · act now", color: "#D9480F" };
  if (d <= 45) return { key: "soon", label: "15–45 days · window closing", color: "#F2C200" };
  return { key: "late", label: "45+ days · may already be down", color: "#7C786F" };
}

export function prettyDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const UNIT_LABEL = { each: "ea", sq_ft: "sq ft", linear_ft: "lin ft" } as const;

export const FLAG_LABEL: Record<string, string> = {
  possible_lead_paint: "Possible lead paint",
  possible_asbestos: "Possible asbestos",
  water_damage: "Water damage",
  mold: "Mold",
};

export const CATEGORY_LABEL = (c: string) => c.replace("_", " ");

/** Proposed pickup slot: two business days out, morning crew. Real scheduling is out of scope. */
export function pickupWindow(from = new Date()) {
  const d = new Date(from);
  let added = 0;
  while (added < 2) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, 8–11 AM`;
}
