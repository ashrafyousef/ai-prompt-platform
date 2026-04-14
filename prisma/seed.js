const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const teams = [
    { slug: "product", name: "Product" },
    { slug: "marketing", name: "Marketing" },
    { slug: "design", name: "Design" },
  ];

  const teamRows = {};
  for (const t of teams) {
    const row = await prisma.team.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: t,
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
  await prisma.user.upsert({
    where: { email: demoEmail },
    update: { role: "ADMIN", teamId: teamRows.design.id },
    create: {
      email: demoEmail,
      name: "demo",
      role: "ADMIN",
      teamId: teamRows.design.id,
    },
  });
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
