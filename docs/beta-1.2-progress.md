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

## Phase 2B.1 — in progress

Minimal task-domain schema: `Client`, `Project`, `ProjectTeamAssignment`, `ProjectStatus` enum, migration, and `lib/projectAccess.ts` read helper. No UI or Brief model yet.
