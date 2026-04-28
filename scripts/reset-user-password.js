const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const ROUNDS = 12; // Must stay aligned with lib/password.ts

function parseArg(flag) {
  const idx = process.argv.findIndex((arg) => arg === flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function maskDatabaseUrl(raw) {
  if (!raw) return "(not set)";
  try {
    const url = new URL(raw);
    if (url.password) url.password = "***";
    if (url.username) url.username = "***";
    return `${url.protocol}//${url.username ? "***:***@" : ""}${url.host}${url.pathname}`;
  } catch {
    return "(unparseable)";
  }
}

function usage() {
  console.error(
    'Usage: node scripts/reset-user-password.js --email "user@example.com" --password "new-password" [--dry-run]'
  );
}

async function main() {
  const emailRaw = parseArg("--email");
  const password = parseArg("--password");
  const dryRun = hasFlag("--dry-run");

  if (!emailRaw || !password) {
    usage();
    process.exitCode = 1;
    return;
  }

  const email = normalizeEmail(emailRaw);
  if (!email.includes("@")) {
    console.error("Invalid email format.");
    process.exitCode = 1;
    return;
  }
  if (password.length < 8 || password.length > 128) {
    console.error("Password must be between 8 and 128 characters.");
    process.exitCode = 1;
    return;
  }

  console.log("Target DATABASE_URL:", maskDatabaseUrl(process.env.DATABASE_URL));
  console.log("Target user:", email);
  console.log("Mode:", dryRun ? "DRY RUN (no changes applied)" : "APPLY");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    console.error("User not found. No changes made.");
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log("Dry run complete. User exists; password would be updated.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
    select: { id: true },
  });

  console.log("Password reset complete for requested user.");
}

main()
  .catch((error) => {
    console.error("Password reset failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
