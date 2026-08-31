import { isIP } from "node:net";

const FALLBACK_CLIENT_IP = "local";

export function getClientIpFromHeaders(headers: Pick<Headers, "get">): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const forwardedIp = forwardedFor.split(",").map(normalizeClientIp).find(Boolean);
    if (forwardedIp) return forwardedIp;
  }

  const forwarded = headers.get("forwarded");
  if (forwarded) {
    const forwardedIp = forwarded.split(",").map(getForwardedForValue).map(normalizeClientIp).find(Boolean);
    if (forwardedIp) return forwardedIp;
  }

  return normalizeClientIp(headers.get("x-real-ip")) ?? FALLBACK_CLIENT_IP;
}

function getForwardedForValue(entry: string): string | null {
  const forParameter = entry
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith("for="));

  if (!forParameter) return null;
  return forParameter.slice(4).trim().replace(/^"|"$/g, "");
}

function normalizeClientIp(value: string | null): string | undefined {
  let normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === "unknown") return undefined;

  normalized = stripForwardedPort(normalized);

  // Accept ordinary IPv4/IPv6 values plus provider-added zone identifiers,
  // while rejecting hostnames, whitespace/control characters and header-injection input.
  if (isValidIpv4(normalized) || isSafeIpv6Candidate(normalized)) return normalized;
  return undefined;
}

function stripForwardedPort(value: string): string {
  const bracketedIpv6 = /^\[([^\]]+)](?::\d+)?$/.exec(value);
  if (bracketedIpv6) return bracketedIpv6[1];

  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(value);
  return ipv4WithPort?.[1] ?? value;
}

function isValidIpv4(value: string): boolean {
  return isIP(value) === 4;
}

function isSafeIpv6Candidate(value: string): boolean {
  return isIP(value) === 6;
}
