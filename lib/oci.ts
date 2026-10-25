// Server-only: OCI Generative AI client + prompts. Never import from client components.
import * as common from "oci-common";
import * as genai from "oci-generativeaiinference";

const REGION = process.env.OCI_REGION ?? "us-chicago-1";
const ENDPOINT = `https://inference.generativeai.${REGION}.oci.oraclecloud.com`;
export const MODEL = process.env.OCI_MODEL_ID ?? "meta.llama-4-maverick-17b-128e-instruct-fp8";

let cached: { client: genai.GenerativeAiInferenceClient; compartmentId: string } | null = null;

// Lazy so `next build` never touches ~/.oci/config.
function getClient() {
  if (cached) return cached;
  const provider = new common.ConfigFileAuthenticationDetailsProvider(
    undefined, process.env.OCI_CONFIG_PROFILE ?? "DEFAULT");
  const client = new genai.GenerativeAiInferenceClient({ authenticationDetailsProvider: provider });
  client.endpoint = ENDPOINT;
  const compartmentId = process.env.OCI_COMPARTMENT_ID || provider.getTenantId();
  cached = { client, compartmentId };
  return cached;
}

export async function chat(system: string, userText: string, imagesB64: string[] = [], maxTokens = 3000) {
  const { client, compartmentId } = getClient();
  const content: any[] = [
    { type: "TEXT", text: userText },
    // Label each image so photoIndex in the manifest points at the right photo.
    ...imagesB64.flatMap((b64, i) => [
      { type: "TEXT", text: `Photo ${i}:` },
      { type: "IMAGE", imageUrl: { url: `data:image/jpeg;base64,${b64}` } },
    ]),
  ];
  const started = Date.now();
  const res = await client.chat({
    chatDetails: {
      compartmentId,
      servingMode: { servingType: "ON_DEMAND", modelId: MODEL } as any,
      chatRequest: {
        apiFormat: "GENERIC",
        messages: [
          { role: "SYSTEM", content: [{ type: "TEXT", text: system }] },
          { role: "USER", content },
        ],
        maxTokens,
        temperature: 0.2,
      } as any,
    },
  });
  const r = (res as genai.responses.ChatResponse).chatResult.chatResponse as any;
  const text = r.choices[0].message.content[0].text as string;
  console.log(`[oci] ${MODEL} images=${imagesB64.length} latency=${Date.now() - started}ms`);
  return text;
}

export const MANIFEST_SYSTEM = `You are a building-materials salvage appraiser in Nashville, Tennessee. You look at photos of a house that is scheduled for demolition and list every item that could be removed and reused by a nonprofit, a reuse store, or a family. You are practical and conservative: only list items you can actually see. Never guess hidden items.`;

export function manifestPrompt(n: number, address: string, permitType: string) {
  return `These ${n} photos are from a house at ${address} scheduled for demolition.
Permit type: ${permitType}.

List the salvageable items. Rules:
- Group identical items into one entry with a quantity (e.g. 6 interior doors).
- category must be one of: doors, windows, cabinets, countertops, flooring_hardwood, flooring_tile, plumbing_fixtures, lighting_fixtures, appliances, hardware, lumber_trim, brick_stone, metal, furniture, other.
- unit is "each" for countable items, "sq_ft" for flooring or tile, "linear_ft" for trim and cabinets runs.
- condition: excellent | good | fair | poor, judged only from what is visible.
- reusable: false if the item is visibly broken, rotten, or moldy.
- safetyFlags: add "possible_lead_paint" for painted wood or windows that look pre-1980, "possible_asbestos" for old vinyl floor tiles, popcorn ceilings, or pipe wrap, "water_damage" or "mold" if visible, otherwise ["none"].
- photoIndex: the number of the photo (as labeled "Photo 0", "Photo 1", ...) where the item is clearest.
- At most 25 items. Skip structural elements (walls, roof, framing) and anything bolted into concrete.

Return ONLY valid JSON, no markdown, matching exactly:
{
  "items": [
    {"name": string, "category": string, "quantity": number, "unit": string, "condition": string, "reusable": boolean, "safetyFlags": string[], "photoIndex": number, "notes": string}
  ],
  "houseNotes": string,
  "confidence": "low" | "medium" | "high"
}`;
}

export const REASON_SYSTEM = `You write one short, specific sentence explaining why a nonprofit is a good home for salvaged building materials. No hype, no emoji, under 25 words.`;

export function reasonPrompt(name: string, blurb: string, itemList: string) {
  return `Nonprofit: ${name} — ${blurb}
Items going to them: ${itemList}
Write the sentence. Name at least one of the specific items and what this nonprofit will do with it.`;
}

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
