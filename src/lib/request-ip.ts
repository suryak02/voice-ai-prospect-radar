const FALLBACK_CLIENT_IP = "local";

export function getClientIpFromHeaders(headers: Pick<Headers, "get">): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const forwardedIp = forwardedFor.split(",").map(normalizeClientIp).find(Boolean);
    if (forwardedIp) return forwardedIp;
  }

  return normalizeClientIp(headers.get("x-real-ip")) ?? FALLBACK_CLIENT_IP;
}

function normalizeClientIp(value: string | null): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === "unknown") return undefined;

  // Accept ordinary IPv4/IPv6 values plus provider-added zone identifiers,
  // while rejecting whitespace/control characters and header-injection input.
  return /^[a-z0-9:.%-]+$/i.test(normalized) ? normalized : undefined;
}
