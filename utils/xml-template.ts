export const XML_TEMPLATE_NONE_ID = -1;
export const XML_TEMPLATE_NONE_OPTION_VALUE = String(XML_TEMPLATE_NONE_ID);
export const XML_TEMPLATE_NONE_OPTION_LABEL = "Default (no template)";

export function normalizeOptionalTemplateId(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  const integerValue = Math.trunc(parsed);
  return integerValue > 0 ? integerValue : undefined;
}
