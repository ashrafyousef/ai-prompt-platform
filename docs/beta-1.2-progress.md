# Beta 1.2 Progress

Lightweight milestone notes for the `next/beta-1.2` branch. Factual checkpoints only.

## Phase 0 — complete

- Production `main` protected; stable tag `stable-before-beta-1.2`
- Beta branch `next/beta-1.2` active
- Beta Neon DB and Vercel deployment operational
- Beta owner account provisioned

## Phase 2A — complete

- **Visual Director** published and active in chat (`visual-director`)
- **Nur - Creative Director** reserved as draft/inactive placeholder (`nur-creative-director`)
- Smoke tests passed: text chat, chat history, image upload, image analysis
- Fixes merged on beta: auth/session handling, build typing, `ChatSession.summary` migration, Blob image upload

## Latest beta commit (at Phase 2A closeout)

`c9a85ce` — Fix beta Blob image upload (#16)

## Phase 2B — inspection complete

Task-first domain foundation planning in `docs/beta-1.2-domain-foundation.md`.

## Phase 2B.1 — complete

Minimal task-domain schema: `Client`, `Project`, `ProjectTeamAssignment`, `ProjectStatus` enum, migration, and `lib/projectAccess.ts` read helper. Beta migration applied.

## Phase 2B.2 — complete

Admin API foundation: `/api/admin/clients` and `/api/admin/projects` (GET/POST).

## Phase 2B.3 — complete

Admin UI: `/admin/clients` and `/admin/projects` list + create forms.

## Phase 2B.4 — complete

Brief domain foundation: `BriefStatus`, `Brief` model, migration, `lib/briefAccess.ts`, `GET/POST /api/admin/briefs`, tests, Brief Specialist draft baseline in seed definitions. No Brief UI yet.

## Phase 2B.5 — complete

Minimal project detail + brief visibility: `GET /api/admin/projects/[projectId]`, `/admin/projects/[projectId]` with project metadata and read-only brief panel, create-brief action via existing POST API, project list links. No brief intake or edit UI.

## Phase 2C — complete

Brief intake form foundation: `lib/briefIntake.ts` v1 schema, `PATCH /api/admin/briefs/[briefId]`, intake form on project detail, save draft and submit to `SUBMITTED`, `responsesJson` exposed only on project detail GET. No chat or agent handoff.
