const safeParseJson = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const decodeSocketPayloadValue = async (payload: unknown): Promise<unknown> => {
  if (typeof Blob !== "undefined" && payload instanceof Blob) {
    try {
      return await payload.text();
    } catch {
      return null;
    }
  }
  if (typeof ArrayBuffer !== "undefined" && payload instanceof ArrayBuffer) {
    if (typeof TextDecoder !== "undefined") {
      try {
        return new TextDecoder().decode(payload);
      } catch {
        return payload;
      }
    }
    return payload;
  }
  if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(payload)) {
    const view = payload as ArrayBufferView;
    if (typeof TextDecoder !== "undefined") {
      try {
        return new TextDecoder().decode(view.buffer);
      } catch {
        return view;
      }
    }
    return view;
  }
  return payload;
};

const extractMessagesFromString = (raw: string): unknown[] => {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const direct = safeParseJson(trimmed);
  if (direct) {
    if (Array.isArray(direct)) {
      return direct;
    }
    if (typeof direct === "object") {
      return [direct];
    }
  }

  const normalizedBatch = safeParseJson(`[${trimmed.replace(/}\s*{/g, "},{")}]`);
  if (Array.isArray(normalizedBatch)) {
    return normalizedBatch;
  }

  return trimmed
    .split(/(?<=\})\s+(?=\{)/)
    .map((chunk) => safeParseJson(chunk))
    .filter((chunk): chunk is unknown => Boolean(chunk));
};

export const parseHyperHiveSocketPayload = async (payload: unknown): Promise<unknown[]> => {
  const decoded = await decodeSocketPayloadValue(payload);
  if (decoded === null || decoded === undefined) {
    return [];
  }
  if (Array.isArray(decoded)) {
    return decoded;
  }
  if (typeof decoded === "object") {
    return [decoded];
  }
  if (typeof decoded === "string") {
    return extractMessagesFromString(decoded);
  }
  return [];
};
