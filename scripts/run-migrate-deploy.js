const { spawnSync } = require("child_process");

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not set. Skipping prisma migrate deploy for local build.");
  process.exit(0);
}

const result = spawnSync("npx prisma migrate deploy", {
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
