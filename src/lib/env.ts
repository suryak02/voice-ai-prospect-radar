export function getEnvValue(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;

  const sanitized = value.trim().replace(/^\uFEFF/, "");
  return sanitized || undefined;
}
