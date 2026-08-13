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
  const { error, message, detail } = data as { error?: unknown; message?: unknown; detail?: unknown };

  for (const value of [error, message, detail]) {
    if (typeof value === "string" && value.trim()) return value;
    if (value && typeof value === "object" && "message" in value) {
      const nestedMessage = (value as { message?: unknown }).message;
      if (typeof nestedMessage === "string" && nestedMessage.trim()) return nestedMessage;
    }
  }

  return null;
}
