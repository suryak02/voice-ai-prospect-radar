export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed) {
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}, but the server returned no error body.`);
    }
    throw new Error("Request succeeded, but the server returned no JSON body.");
  }

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}, but the server returned invalid JSON.`);
    }
    throw new Error("Request succeeded, but the server returned invalid JSON.");
  }

  if (!response.ok) {
    const error = getErrorMessage(data);
    throw new Error(error ?? `Request failed with ${response.status}.`);
  }

  return data as T;
}

function getErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const { error, errors, message, detail, error_description, title, reason } = data as {
    error?: unknown;
    errors?: unknown;
    message?: unknown;
    detail?: unknown;
    error_description?: unknown;
    title?: unknown;
    reason?: unknown;
  };

  for (const value of [error, errors, message, detail, error_description, title, reason]) {
    const message = extractErrorMessage(value);
    if (message) return message;
  }

  return null;
}

function extractErrorMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();

  if (Array.isArray(value)) {
    const messages = value.flatMap((item) => {
      const message = extractErrorMessage(item);
      return message ? [message] : [];
    });
    return messages.length > 0 ? messages.join("; ") : null;
  }

  if (value && typeof value === "object" && "message" in value) {
    return extractErrorMessage((value as { message?: unknown }).message);
  }

  return null;
}
