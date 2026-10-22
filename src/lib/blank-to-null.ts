/** Form fields arrive as "" when left blank; absence is stored as null. */
export function blankToNull(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? null : value;
}
