// Letters that Unicode decomposition does not reduce to a base letter.
const plainLetters: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ı: "i",
  ħ: "h",
};

/**
 * Text reduced to what a search should compare: lowercase, without accents,
 * punctuation and runs of spaces as one space. "Neustadt a.d. Weinstraße"
 * becomes "neustadt a d weinstrasse".
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLocaleLowerCase("en")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[ßæœøłđðþıħ]/g, (letter) => plainLetters[letter] ?? letter)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
