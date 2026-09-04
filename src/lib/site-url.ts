const DEFAULT_SITE_URL = "https://voice-ai-prospect-map.vercel.app";

export function normalizeSiteUrl(value: string | undefined): string {
  const sanitized = value?.trim().replace(/\/+$/g, "");
  if (!sanitized) return DEFAULT_SITE_URL;

  try {
    const url = new URL(sanitized);
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_SITE_URL;
    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
