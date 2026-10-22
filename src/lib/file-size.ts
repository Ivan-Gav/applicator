const units = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;

/** A size in bytes for display, in steps of 1024: "512 byte", "240.5 kB", "4 MB". */
export function formatFileSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return new Intl.NumberFormat("en-GB", {
    style: "unit",
    unit: units[unit],
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}
