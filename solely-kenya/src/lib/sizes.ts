// Sellers often type a size run as a range ("38-45", "S-XL") instead of
// listing each size. Expand those into individual sizes so buyers can pick
// one. Anything that isn't a clear range is kept exactly as typed.

const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const RANGE = /^\s*([A-Za-z]+|\d+)\s*(?:-|–|—|to)\s*([A-Za-z]+|\d+)\s*$/i;
const MAX_NUMERIC_SPAN = 20; // "38-45" yes; "1-500" is not a size run

const expandOne = (raw: string): string[] => {
  const value = raw.trim();
  const m = value.match(RANGE);
  if (!m) return [value];
  const [, from, to] = m;

  if (/^\d+$/.test(from) && /^\d+$/.test(to)) {
    const a = parseInt(from, 10);
    const b = parseInt(to, 10);
    if (b <= a || b - a > MAX_NUMERIC_SPAN) return [value];
    return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
  }

  const i = LETTER_SIZES.indexOf(from.toUpperCase());
  const j = LETTER_SIZES.indexOf(to.toUpperCase());
  if (i === -1 || j === -1 || j <= i) return [value];
  return LETTER_SIZES.slice(i, j + 1);
};

/** Expand ranges and drop blanks and duplicates, keeping the seller's order. */
export const expandSizes = (sizes: (string | null | undefined)[] | null | undefined): string[] => {
  const out: string[] = [];
  for (const s of sizes ?? []) {
    if (!s || !s.trim()) continue;
    for (const size of expandOne(s)) if (!out.includes(size)) out.push(size);
  }
  // All-numeric runs read best in ascending order ("40, 39-41" -> 39, 40, 41).
  if (out.length > 1 && out.every((s) => /^\d+(\.\d+)?$/.test(s))) {
    out.sort((a, b) => parseFloat(a) - parseFloat(b));
  }
  return out;
};

/** Parse a comma-separated size field as typed by a seller. */
export const parseSizesInput = (text: string): string[] => expandSizes(text.split(","));
