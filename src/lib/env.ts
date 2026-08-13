export function getEnvValue(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;

  const sanitized = value.trim().replace(/^\uFEFF/, "");
  return sanitized || undefined;
}

export function getBooleanEnvValue(name: string): boolean {
  const value = getEnvValue(name);
  if (!value) return false;

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
