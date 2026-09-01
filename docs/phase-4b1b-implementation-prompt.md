# Cursor implementation prompt — Phase 4B.1B

Copy everything below the line into a new Cursor agent turn after the plan is approved.

---

You are implementing AI Workspace Beta 1.2:

# Phase 4B.1B — Member Project Authorization Foundation

## Repository

- Repo: ashrafyousef/ai-prompt-platform
- Branch: `next/beta-1.2`
- HEAD: `4255629` — Add project team assignment management
- Worktree may include untracked `docs/phase-4b0-member-project-access-readiness.md` and plan doc `docs/phase-4b1b-member-project-authorization-foundation.md` — do not commit docs unless asked

## Goal

Build the **backend authorization foundation** for matching-team MEMBER project **read** access.

Do **not** deliver MEMBER `/projects` UI (Phase 4B.2).  
Do **not** enable MEMBER project chats (Phase 4B.3 / after 4B.K).  
Do **not** change knowledge injection (Phase 4B.K).

Follow plan: `docs/phase-4b1b-member-project-authorization-foundation.md`

## Inspect first

- `lib/projectAccess.ts`
- `lib/workspaceAccess.ts`
- `lib/adminAuth.ts` (`requireWorkspaceMemberManagerContext`, `getAdminSessionOrRedirect`)
- `lib/auth.ts` (`requireAuthorizedUserContext` — note `User.teamId` fallback; do not use it for project access)
- `middleware.ts` `/projects` gate
- `app/(app)/projects/layout.tsx`
- `GET/POST /api/admin/projects`
- `GET/PATCH /api/admin/projects/[projectId]`
- Existing `tests/projectAccess.test.ts`, projects layout, admin project routes

## Implement

### 1. Shared project actor (DB-backed)

Add `requireProjectActorContext()` (or equivalent) that returns a project actor:

- `userId`, `workspaceId`, `workspaceRole`, `platformRole`, eligible `teamId`
- Active `WorkspaceMember` only
- `teamId` from **WorkspaceMember.teamId only** — never `User.teamId`, never JWT team claims
- If membership `teamId` is set, validate nested Team in the same query snapshot: same `workspaceId`, `isArchived: false`, matching id
  - Invalid/archived/cross-workspace → **Forbidden** (do not coerce to null)
- Genuine `teamId === null` remains valid teamless membership
- Platform role from fresh `User.role` in the same snapshot
- Never select or use `User.teamId`

### 2. Harden project visibility

Update `canViewProjectForActor` and list filter helpers so:

- Workspace-wide: OWNER, platform ADMIN, workspace ADMIN with no team — unchanged
- Team-matched path: eligible actor teamId must appear on an **active same-workspace** assignment Team
- Raw assignment IDs alone must **never** authorize team-scoped actors
- Zero teams / missing Team / archived Team / cross-workspace Team → fail closed
- Production callers pass assignment+Team metadata via `toProjectAccessTargetFromAssignments`

Add an explicit manager/mutate helper if needed; mutations must not use MEMBER-capable context alone.

### 3. Wire dedicated read APIs only

- `GET /api/projects` — project actor + filtered list; matching MEMBER may list assigned projects with restricted read model
- `GET /api/projects/[projectId]` — project actor + target where; matching MEMBER may read restricted detail; inaccessible IDs → sanitized `404`

Keep manager-only (do **not** open these to MEMBER):

- `GET/POST /api/admin/projects`
- `GET/PATCH /api/admin/projects/[projectId]`
- All brief/strategy mutations
- Project-linked chat list/create with projectId
- Assignment catalog behavior from 4B.1A for managers

### 4. Do **not** change in this phase

- Middleware `/projects` Membership admission (stay manager-gated)
- `projects/layout.tsx` / `getAdminSessionOrRedirect` for page shell
- MEMBER nav
- Chat send / agents / knowledge
- Prisma schema / migrations
- Brief/strategy GET broadening (unless a tiny shared helper requires it — prefer defer to 4B.2)

## Tests

Add/update comprehensive tests for actor resolution, visibility matrix, GET list/detail MEMBER success/denial, mutation MEMBER still 403, manager regressions, archived/invalid team fail-closed, cross-workspace deny, multi-team one-match.

Run at least:

```bash
npx vitest run \
  tests/projectAccess.test.ts \
  tests/adminClientProjectRoutes.test.ts \
  tests/adminProjectDetailRoute.test.ts \
  tests/adminProjectAssignmentPatchRoute.test.ts \
  tests/getAdminSessionOrRedirect.test.ts \
  tests/projectsLayoutGuard.test.ts \
  tests/adminRouteAuthorization.test.ts
```

Plus any new test files. Then `npx vitest run`, `git diff --check`, `npm run lint`, `npm run build`.

## Boundaries

- Do not commit
- Do not enable MEMBER `/projects` UI
- Do not enable MEMBER chats
- Do not change knowledge injection
- Do not use `User.teamId` for project access
- Preserve OWNER / ADMIN / platform ADMIN behavior
- Fail closed for no-team, inactive, removed, archived-team, invalid-team, cross-workspace

## Report

Summarize:

1. Actor resolver behavior  
2. Visibility / list filter changes  
3. Which endpoints now admit MEMBER read (`GET /api/projects`, `GET /api/projects/[projectId]` — not `/api/admin/projects*`)  
4. What remains manager-only (including all `/api/admin/projects*` routes)  
5. Tests and validation  
6. Confirmation middleware/layout still deny MEMBER pages  

Suggested later commit message: `Add member project authorization foundation`
