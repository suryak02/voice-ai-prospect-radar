const DEFAULT_SITE_URL = "https://voice-ai-prospect-map.vercel.app";

export function normalizeSiteUrl(value: string | undefined): string {
  const sanitized = value?.trim().replace(/\/+$/g, "");
  return sanitized || DEFAULT_SITE_URL;
}

export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
