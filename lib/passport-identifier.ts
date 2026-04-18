/**
 * Generates a deterministic text identifier from passport data.
 * Format: PLGR-XXXX-XXXX  (uppercase alphanumeric, no ambiguous chars)
 */
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,1,0

export function generateIdentifier(passportId: number, passportNumber: string): string {
  // Simple deterministic mix of id and number chars
  let seed = passportId * 6271;
  for (let i = 0; i < passportNumber.length; i++) {
    seed = (seed * 31 + passportNumber.charCodeAt(i)) >>> 0;
  }

  let out = "";
  for (let i = 0; i < 8; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0; // LCG
    out += CHARS[seed % CHARS.length];
    if (i === 3) out += "-";
  }
  return `PLGR-${out}`;
}

/** Split a passport number like "PLG-00042" into series + number for display */
export function splitPassportNumber(pn: string): { series: string; number: string } {
  const dash = pn.indexOf("-");
  if (dash === -1) return { series: "", number: pn };
  return { series: pn.slice(0, dash), number: pn.slice(dash + 1) };
}
