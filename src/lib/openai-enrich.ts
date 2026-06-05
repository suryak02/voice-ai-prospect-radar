import { CATEGORY_META, CATEGORY_VALUES } from "@/lib/categories";

/**
 * OpenAI enrichment with two depths:
 * - standard: a personalized assessment from the business's Google signals.
 * - deep: also fetches and reads the business's website, for a source-grounded
 *   brief. Admin-only (enforced in the route) and slower/costlier.
 *
 * Both are deliberately cheap (mini model, capped tokens) and cached in the DB
 * with a weekly cooldown. Returns null when no API key is configured.
 */

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

export type EnrichInput = {
  name: string;
  category: string;
  address: string;
  borough: string;
  rating?: number | null;
  reviewCount?: number | null;
  hasWebsite: boolean;
  hasOnlineBooking: boolean;
  hasVisiblePhone: boolean;
  voiceAiScore: number;
  recommendedUseCase: string;
  website?: string | null;
};

export type Enrichment = { summary: string; angle: string; category?: string; usedWebsite?: boolean };

export function resolveOpenAiModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

const CATEGORY_LIST = CATEGORY_VALUES.map((value) => `${value} (${CATEGORY_META[value].label})`).join(", ");

const BASE_RULES = [
  "You are a B2B sales analyst for a Voice AI company that sells an AI phone receptionist (handles missed calls, books appointments, qualifies leads, answers FAQs).",
  "Assess how strong a prospect the business is for the AI receptionist, grounded ONLY in the information provided — never invent facts.",
  "Reply with strict JSON: {\"summary\": string, \"angle\": string, \"category\": string}.",
  `category: the single best-fit value from this list: ${CATEGORY_LIST}.`,
  "No markdown, no preamble.",
];

const STANDARD_SYSTEM_PROMPT = [
  ...BASE_RULES,
  "You are given the business's public Google signals as JSON.",
  "summary: 2-3 sentences, specific to THIS business, on why it is (or isn't) a good fit and the likely pain.",
  "angle: one concise outreach hook.",
].join("\n");

const DEEP_SYSTEM_PROMPT = [
  ...BASE_RULES,
  "You are given the business's Google signals AND extracted text from their website.",
  "Use the website text to ground the analysis in specifics: services/treatments offered, whether online booking exists, opening hours or out-of-hours gaps, and any concrete missed-call or scheduling pain.",
  "summary: 4-6 sentences citing concrete details you actually found in the website text (do not fabricate).",
  "angle: a tailored outreach hook that references a specific detail about this business.",
].join("\n");

async function fetchWebsiteText(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    // Skip Google Maps/search fallbacks — not the business's own site.
    if (parsed.hostname.includes("google.")) return null;

    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VoiceAIProspectBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) return null;

    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 80 ? text.slice(0, 4000) : null;
  } catch {
    return null;
  }
}

export async function enrichBusiness(input: EnrichInput, opts: { deep?: boolean } = {}): Promise<Enrichment | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const websiteText = opts.deep && input.website ? await fetchWebsiteText(input.website) : null;

  const signals = {
    name: input.name,
    ruleBasedCategory: input.category,
    area: input.borough,
    address: input.address,
    googleRating: input.rating ?? null,
    googleReviewCount: input.reviewCount ?? null,
    hasWebsite: input.hasWebsite,
    hasOnlineBookingSignal: input.hasOnlineBooking,
    hasVisiblePhone: input.hasVisiblePhone,
    ruleBasedVoiceAiScore: `${input.voiceAiScore}/9`,
    suggestedUseCase: input.recommendedUseCase,
  };

  const userContent = websiteText
    ? `Signals:\n${JSON.stringify(signals)}\n\nWebsite text (extracted):\n${websiteText}`
    : JSON.stringify(signals);

  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: resolveOpenAiModel(),
      messages: [
        { role: "system", content: opts.deep ? DEEP_SYSTEM_PROMPT : STANDARD_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: opts.deep ? 520 : 320,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed: { summary?: unknown; angle?: unknown; category?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const angle = typeof parsed.angle === "string" ? parsed.angle.trim() : "";
  if (!summary && !angle) return null;

  const rawCategory = typeof parsed.category === "string" ? parsed.category.trim().toLowerCase() : "";
  const category = (CATEGORY_VALUES as string[]).includes(rawCategory) ? rawCategory : undefined;

  return { summary, angle, category, usedWebsite: Boolean(websiteText) };
}
