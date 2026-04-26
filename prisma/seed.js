const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function slugifyWorkspaceName(name) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length > 0 ? base : "workspace";
}

async function main() {
  const wsName = process.env.ADMIN_SEED_WORKSPACE_NAME || "Default";
  const baseSlug = slugifyWorkspaceName(wsName);
  const workspaceSlug = `${baseSlug}-seed-root`;
  const workspace = await prisma.workspace.upsert({
    where: { slug: workspaceSlug },
    update: { name: wsName },
    create: { name: wsName, slug: workspaceSlug },
  });

  const teams = [
    { slug: "product", name: "Product" },
    { slug: "marketing", name: "Marketing" },
    { slug: "design", name: "Design" },
  ];

  const teamRows = {};
  for (const t of teams) {
    const row = await prisma.team.upsert({
      where: { slug: t.slug },
      update: { name: t.name, workspaceId: workspace.id },
      create: {
        ...t,
        workspaceId: workspace.id,
      },
    });
    teamRows[t.slug] = row;
  }

  const agents = [
    {
      slug: "design-prompt-generator",
      name: "Design Prompt Generator",
      description: "Creates structured prompts for UI/UX and product design tasks.",
      systemPrompt:
        "You are a design prompt engineer. Produce clear, actionable prompts with constraints, audience, and output goals.",
      outputFormat: "markdown",
      temperature: 0.4,
      maxTokens: 900,
      status: "PUBLISHED",
      scope: "TEAM",
      workspaceId: workspace.id,
      teamId: teamRows.design.id,
    },
    {
      slug: "photography-prompt-generator",
      name: "Photography Prompt Generator",
      description: "Builds photography prompt blueprints with style and lighting details.",
      systemPrompt:
        "You are a professional photography prompt assistant. Include lens style, lighting, framing, and post-processing notes.",
      outputFormat: "markdown",
      temperature: 0.5,
      maxTokens: 900,
      status: "PUBLISHED",
      scope: "GLOBAL",
      workspaceId: workspace.id,
      teamId: null,
    },
    {
      slug: "image-generation-prompt-builder",
      name: "Image Generation Prompt Builder",
      description: "Creates robust prompts for image generation systems.",
      systemPrompt:
        "You build precise image-generation prompts. Always include subject, setting, composition, style, and negative constraints.",
      outputFormat: "json",
      outputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          negativePrompt: { type: "string" },
          style: { type: "string" },
        },
        required: ["prompt"],
      },
      temperature: 0.3,
      maxTokens: 700,
      status: "DRAFT",
      scope: "GLOBAL",
      workspaceId: workspace.id,
      teamId: null,
      isEnabled: false,
    },
    {
      slug: "creative-copy-assistant",
      name: "Creative Copy Assistant",
      description: "Generates marketing and brand copy in structured sections.",
      systemPrompt:
        "You are a creative copywriter. Provide concise, compelling copy with variant options and a clear tone.",
      outputFormat: "template",
      temperature: 0.7,
      maxTokens: 1000,
      status: "PUBLISHED",
      scope: "TEAM",
      workspaceId: workspace.id,
      teamId: teamRows.marketing.id,
    },
  ];

  for (const agent of agents) {
    await prisma.agentConfig.upsert({
      where: { slug: agent.slug },
      update: agent,
      create: agent,
    });
  }

  const demoEmail = process.env.ADMIN_SEED_EMAIL || "demo@example.com";
  const seedPassword = process.env.ADMIN_SEED_PASSWORD;
  const passwordHash = seedPassword ? await bcrypt.hash(seedPassword, 12) : null;

  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      role: "ADMIN",
      teamId: teamRows.design.id,
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email: demoEmail,
      name: "demo",
      role: "ADMIN",
      teamId: teamRows.design.id,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });

  const existingMember = await prisma.workspaceMember.findFirst({
    where: { userId: demoUser.id, workspaceId: workspace.id },
  });
  if (!existingMember) {
    await prisma.workspaceMember.create({
      data: {
        userId: demoUser.id,
        workspaceId: workspace.id,
        role: "OWNER",
        teamId: teamRows.design.id,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
