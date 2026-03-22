export const MAX_ID_LENGTH = 128;
export const MAX_TITLE_LENGTH = 256;
export const MAX_CONTENT_LENGTH = 1_000_000; // ~1MB
export const VALID_ROLES = new Set(["user", "assistant", "system"]);

export function validateString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return `${fieldName} must be a string`;
  if (value.length === 0) return `${fieldName} is required`;
  if (value.length > maxLength)
    return `${fieldName} exceeds max length of ${maxLength}`;
  return null; // valid
}

export function validateOptionalString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) return null; // optional
  if (typeof value !== "string") return `${fieldName} must be a string`;
  if (value.length > maxLength)
    return `${fieldName} exceeds max length of ${maxLength}`;
  return null; // valid
}

export function validateRole(value: unknown): string | null {
  if (typeof value !== "string") return "role must be a string";
  if (!VALID_ROLES.has(value))
    return "role must be one of: user, assistant, system";
  return null;
}
