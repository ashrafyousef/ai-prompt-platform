const INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions/gi,
  /ignore\s+all\s+prior/gi,
  /act\s+as\s+system/gi,
  /you\s+are\s+now\s+the\s+system/gi,
];

export function sanitizeUserInput(input: string): string {
  let output = input;
  for (const pattern of INJECTION_PATTERNS) {
    output = output.replace(pattern, "[filtered]");
  }
  return output.trim();
}
