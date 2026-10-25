export const CATEGORIES = [
  "doors", "windows", "cabinets", "countertops", "flooring_hardwood", "flooring_tile",
  "plumbing_fixtures", "lighting_fixtures", "appliances", "hardware", "lumber_trim",
  "brick_stone", "metal", "furniture", "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const SAFETY_FLAGS = ["possible_lead_paint", "possible_asbestos", "water_damage", "mold", "none"] as const;
export type SafetyFlag = (typeof SAFETY_FLAGS)[number];

export type Unit = "each" | "sq_ft" | "linear_ft";
export type Condition = "excellent" | "good" | "fair" | "poor";

export type Permit = {
  id: string; // permit number
  address: string;
  lat: number; lng: number;
  dateIssued: string; // ISO date
  permitType: string; // demolition subtype text from Metro
  description?: string;
  zip?: string;
  contractor?: string;
};

export type ManifestItem = {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  unit: Unit;
  condition: Condition;
  reusable: boolean;
  safetyFlags: SafetyFlag[];
  photoIndex: number;
  notes?: string;
  // filled by server from lookup table, NOT by the AI:
  estValueUsd?: number;
  estWeightLb?: number;
  estCo2Kg?: number;
};

export type Manifest = {
  items: ManifestItem[];
  houseNotes: string;
  confidence: "low" | "medium" | "high";
};

export type Nonprofit = {
  id: string; name: string;
  accepts: Category[];
  prefers?: Category[]; // tie-breaker: these categories go here first
  blurb: string;
  pickup: boolean;
  sample: boolean; // seeded placeholder, labeled "sample" in the UI
  noSafetyFlagged?: boolean; // e.g. families never get flagged items
  url?: string;
};

export type Material = {
  category: Category;
  unit: Unit;
  valueUsdPerUnit: number;
  weightLbPerUnit: number;
  co2KgPerLb: number;
};

export type Match = { nonprofitId: string; itemIds: string[]; reason: string };

export type Totals = { valueUsd: number; weightLb: number; co2Kg: number };

export type Scan = {
  id: string; permitId: string; createdAt: string;
  manifest: Manifest; matches: Match[];
  totals: Totals;
  claims: { nonprofitId: string; itemIds: string[]; at: string }[];
  source: "ai" | "demo"; // "demo" = cached fallback, shown honestly in the UI
  latencyMs?: number;
};

export type Stats = { housesScanned: number; itemsClaimed: number; tonsDiverted: number; valueUsd: number; co2Kg: number };
