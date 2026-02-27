import { apiFetch } from "./api-client";
import { resolveToken } from "./vms-client";

export type XmlTemplatePayload = {
  name: string;
  description?: string;
  xml: string;
};

export type XmlTemplate = {
  id: number;
  name: string;
  description: string;
  xml: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const COLLECTION_KEYS = [
  "templates",
  "xmltemplates",
  "xml_templates",
  "items",
  "results",
  "data",
  "list",
  "records",
  "payload",
];

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const readString = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
};

const readNumber = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const normalizeTemplate = (input: unknown): XmlTemplate | null => {
  const record = asRecord(input);
  if (!record) return null;

  const id = readNumber(record, ["id", "Id", "ID", "template_id", "templateId"]);
  const name = readString(record, ["name", "Name"])?.trim();
  const xml = readString(record, ["xml", "XML", "template_xml", "templateXml"]) ?? "";

  if (!id || !name) {
    return null;
  }

  const description = readString(record, ["description", "Description", "desc"]) ?? "";
  const createdAt =
    readString(record, ["created_at", "createdAt", "CreatedAt"]) ?? null;
  const updatedAt =
    readString(record, ["updated_at", "updatedAt", "UpdatedAt"]) ?? null;

  return {
    id,
    name,
    description,
    xml,
    createdAt,
    updatedAt,
  };
};

const extractTemplateCollection = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  for (const key of COLLECTION_KEYS) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
};

export async function listXmlTemplates(): Promise<XmlTemplate[]> {
  const authToken = await resolveToken();
  const response = await apiFetch<unknown>("/virsh/xmltemplates/", {
    method: "GET",
    token: authToken,
  });

  return extractTemplateCollection(response)
    .map(normalizeTemplate)
    .filter((item): item is XmlTemplate => Boolean(item))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getXmlTemplate(templateId: number): Promise<XmlTemplate> {
  const authToken = await resolveToken();
  const response = await apiFetch<unknown>(`/virsh/xmltemplates/${encodeURIComponent(String(templateId))}`, {
    method: "GET",
    token: authToken,
  });

  const normalized = normalizeTemplate(response);
  if (!normalized) {
    throw new Error("Invalid XML template response.");
  }
  return normalized;
}

export async function createXmlTemplate(payload: XmlTemplatePayload): Promise<XmlTemplate | null> {
  const authToken = await resolveToken();
  const response = await apiFetch<unknown>("/virsh/xmltemplates/", {
    method: "POST",
    token: authToken,
    body: {
      name: payload.name.trim(),
      description: payload.description?.trim() || "",
      xml: payload.xml,
    },
  });
  return normalizeTemplate(response);
}

export async function updateXmlTemplate(
  templateId: number,
  payload: XmlTemplatePayload
): Promise<XmlTemplate | null> {
  const authToken = await resolveToken();
  const response = await apiFetch<unknown>(`/virsh/xmltemplates/${encodeURIComponent(String(templateId))}`, {
    method: "PUT",
    token: authToken,
    body: {
      name: payload.name.trim(),
      description: payload.description?.trim() || "",
      xml: payload.xml,
    },
  });
  return normalizeTemplate(response);
}

export async function deleteXmlTemplate(templateId: number): Promise<void> {
  const authToken = await resolveToken();
  await apiFetch<void>(`/virsh/xmltemplates/${encodeURIComponent(String(templateId))}`, {
    method: "DELETE",
    token: authToken,
  });
}
