const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function parseArg(flag) {
  const idx = process.argv.findIndex((arg) => arg === flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function resolveMainWorkspace() {
  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });
  if (!workspace) {
    throw new Error(
      "No workspace found. Create/sign up first or run the seed script to bootstrap a workspace."
    );
  }
  return workspace;
}

async function resolveMainTeam(workspaceId) {
  const teams = await prisma.team.findMany({
    where: { workspaceId, isArchived: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const preferred =
    teams.find((t) => /(^admin$|admin|core)/i.test(t.slug)) ??
    teams.find((t) => /(^admin$|admin|core)/i.test(t.name));
  if (preferred) return preferred;
  if (teams[0]) return teams[0];

  const base = "core-admin";
  const slug = `${base}-${Date.now().toString(36)}`;
  return prisma.team.create({
    data: {
      workspaceId,
      name: "Core Admin",
      slug,
    },
    select: { id: true, name: true, slug: true },
  });
}

async function main() {
  const emailRaw = parseArg("--email") || process.env.ADMIN_SEED_EMAIL;
  if (!emailRaw) {
    throw new Error(
      'Missing admin email. Usage: node scripts/bootstrap-local-admin.js --email "you@example.com"'
    );
  }

  const email = emailRaw.trim().toLowerCase();
  const workspace = await resolveMainWorkspace();
  const team = await resolveMainTeam(workspace.id);

  const defaultName = email.split("@")[0] || "admin";
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      teamId: team.id,
    },
    create: {
      email,
      name: defaultName,
      role: "ADMIN",
      teamId: team.id,
    },
    select: { id: true, email: true },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {
      role: "OWNER",
      teamId: team.id,
      isActive: true,
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
      teamId: team.id,
      isActive: true,
    },
  });

  console.log("Local admin bootstrap complete:");
  console.log(`- user: ${user.email}`);
  console.log("- platform role: ADMIN");
  console.log(`- workspace: ${workspace.name} (${workspace.slug})`);
  console.log(`- team: ${team.name} (${team.slug})`);
  console.log("- workspace membership: OWNER (active)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
