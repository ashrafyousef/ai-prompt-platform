const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/gi,
  /ignore\s+all\s+previous\s+instructions/gi,
  /ignore\s+all\s+prior/gi,
  /act\s+as\s+system/gi,
  /act\s+as\s+the\s+system/gi,
  /you\s+are\s+now/gi,
  /you\s+are\s+now\s+the\s+system/gi,
];

export function sanitizeUserInput(input: string): string {
  let output = input ?? "";
  for (const pattern of INJECTION_PATTERNS) {
    output = output.replace(pattern, "");
  }
  // Collapse whitespace created by phrase stripping.
  return output.replace(/\s+/g, " ").trim();
}
