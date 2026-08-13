import type { Transcript } from "@/lib/postlint/types";

export type TextMatch = {
  source: "transcript" | "caption";
  evidence: string;
  matchedText: string;
  timestampStart?: number;
  timestampEnd?: number;
};

export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’‛`´]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}#%'+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsNormalized(haystack: string, needle: string): boolean {
  const normalizedHaystack = normalizeText(haystack);
  const normalizedNeedle = normalizeText(needle);
  if (!normalizedNeedle) return false;
  return ` ${normalizedHaystack} `.includes(` ${normalizedNeedle} `);
}

export function findTextMatch(
  transcript: Transcript | null,
  caption: string,
  searchTerms: string[],
): TextMatch | null {
  const terms = searchTerms.filter((term) => normalizeText(term).length > 0);

  if (transcript) {
    for (const segment of transcript.segments) {
      const matchedText = terms.find((term) => containsNormalized(segment.text, term));
      if (matchedText) {
        return {
          source: "transcript",
          evidence: segment.text,
          matchedText,
          timestampStart: segment.startSeconds,
          timestampEnd: segment.endSeconds,
        };
      }
    }
  }

  const captionTerm = terms.find((term) => containsNormalized(caption, term));
  if (captionTerm) {
    return {
      source: "caption",
      evidence: caption,
      matchedText: captionTerm,
    };
  }

  return null;
}
