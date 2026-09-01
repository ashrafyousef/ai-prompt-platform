# Phase 4B.1B — Member Project Authorization Foundation

**Status:** Plan (not implemented)  
**Branch:** `next/beta-1.2`  
**Baseline HEAD:** `4255629` — Add project team assignment management  
**Prior:** Phase 4B.1A complete · Phase 4B.0 audit: Not ready for MEMBER until foundation + later phases

## Goal

Ship the **backend authorization foundation** so matching-team MEMBER project read access can be enforced fail-closed and tested, without delivering the MEMBER-facing project UI (Phase 4B.2) and without enabling chats (4B.3 / after 4B.K).

Managers (OWNER, workspace ADMIN, platform ADMIN) keep current behavior.

## Non-goals (explicit)

- MEMBER-visible `/projects` shell UI or nav (→ 4B.2)
- MEMBER project chats, chat send/orchestrator changes (→ 4B.3 after 4B.K)
- Knowledge injection / AgentKnowledge hardening (→ 4B.K)
- Knowledge Resolution Foundation / project memory
- Brief or strategy **mutations** for MEMBER
- Brief/strategy **read** API broadening (→ 4B.2, on top of this foundation)
- MEMBER into `/admin`
- Prisma schema / migrations (unless a verified blocker appears)
- `User.teamId` or JWT role/team as authoritative project access
- Reordering 4B.1B → 4B.2 → 4B.K → 4B.3

## Current state (inspected at `4255629`)

| Layer | Behavior |
|---|---|
| Middleware `/projects` | Manager JWT first-pass (MEMBER denied) |
| `app/(app)/projects/layout.tsx` | `getAdminSessionOrRedirect()` — DB manager gate |
| Project APIs | `requireWorkspaceMemberManagerContext()` — MEMBER 403 |
| `canViewProjectForActor` | MEMBER matching-team branch exists but **no HTTP path reaches it** |
| Manager actor `teamId` | `WorkspaceMember.teamId` only |
| `requireAuthorizedUserContext` | Still has `workspaceAccess.teamId ?? user.teamId` — **must not** feed project access |
| Assignments | M:N via `ProjectTeamAssignment`; archived teams ignored by `canViewProjectForActor` today (**gap**) |

## Proposed access contract (4B.1B)

### View (read)

| Actor | Project visibility |
|---|---|
| Workspace OWNER | All projects in workspace |
| Platform ADMIN | All projects in actor’s resolved workspace |
| Workspace ADMIN, no team | All projects in workspace |
| Workspace ADMIN with team | Projects where **any** assignment is actor’s **validated active** team |
| Active MEMBER with validated team | Same as team-scoped ADMIN (matching assignment only) |
| MEMBER no team / inactive team / archived team / cross-workspace team | No projects |
| Project with zero teams | Managers only |
| Inactive / removed membership | Denied before visibility |
| Cross-workspace project | Denied |

### Mutate

Unchanged: create/update/archive/assign project, brief mutations, strategy mutations, admin assignment PATCH — **manager-only** via existing `requireWorkspaceMemberManagerContext` (or explicit `canManageProject…` that mirrors it).

## Architecture

### 1. Shared DB-backed project actor

Add something like `requireProjectActorContext()` (name flexible) that:

1. Requires authenticated session (`userId`)
2. Resolves **active** `WorkspaceMember` via `resolveWorkspaceAccessForUser` (or equivalent)
3. Loads `User.role` for platform ADMIN only
4. Sets `teamId` from **`WorkspaceMember.teamId` only** — never `User.teamId`
5. If membership `teamId` is non-null, nested Team must exist with:
   - `id === teamId`
   - `workspaceId === membership.workspaceId`
   - `isArchived === false`  
   If validation fails → **Forbidden** (never coerce invalid Team to `teamId: null`)
6. Genuine null membership team remains `teamId: null`
7. Never trusts JWT `workspaceRole` / `teamId` as source of truth
8. Prefer one consistent User + `workspaceMembers` (+ nested `team`) query snapshot

Do **not** change `requireAuthorizedUserContext`’s User.teamId fallback for chat/agents in this phase (out of scope); project code paths simply avoid it.

### 2. Harden visibility helpers

Update `lib/projectAccess.ts`:

- `canViewProjectForActor` — fail closed when matching assignment is archived or cross-workspace (prefer `assignedTeams` metadata from DB joins; production callers pass full assignment+team rows)
- `buildProjectListWhere` (evolve `buildAdminProjectListWhere`) — list filter requires assignment to eligible active same-workspace team for non–workspace-wide viewers
- Add `canManageProjectForActor` / `isProjectManagerActor` used by mutations (OWNER / workspace ADMIN / platform ADMIN — same outer gate as today; team-scoped ADMIN still cannot mutate foreign-team projects if that is already implied by view+manager composition)

Preserve OWNER / platform ADMIN / teamless ADMIN workspace-wide read.

### 3. HTTP wiring (foundation, not UI)

**In scope for 4B.1B (approved architecture):**

| Endpoint | Change |
|---|---|
| `GET /api/projects` | Dedicated MEMBER-capable list; `requireProjectActorContext` + hardened list where; restricted read model |
| `GET /api/projects/[projectId]` | Dedicated MEMBER-capable detail; sanitized `404` for inaccessible IDs; restricted read model (no brief/strategy/chats/knowledge) |

**Remain manager-only (unchanged):**

- `GET/POST /api/admin/projects`
- `GET/PATCH /api/admin/projects/[projectId]` (manager payloads may still include brief/strategy)
- All brief / strategy mutating routes
- Project chats list/create with `projectId`
- `/api/admin/*` admin console surfaces

Do **not** open existing `/api/admin/projects*` GET handlers to MEMBER.

**Deferred to 4B.2:**

- Middleware `/projects` MEMBER admission
- `projects/layout.tsx` gate change away from `getAdminSessionOrRedirect`
- Nav visibility for MEMBER
- Read-only brief/strategy UI + any GET broadening those need
- Capabilities object for UI panels

Rationale: Dedicated read APIs become ready and testable without exposing admin brief/strategy payloads. MEMBER still cannot browse `/projects` until 4B.2.

### 4. Read vs mutation separation

Introduce explicit helpers so routes do not overload “manager context” for reads:

- Read: `requireProjectActorContext` + `canViewProjectForActor`
- Mutate: keep `requireWorkspaceMemberManagerContext` (or equivalent manager assert after project actor)

### 5. Tests (required)

Unit + route coverage for:

- OWNER / ADMIN / platform ADMIN unchanged
- Matching-team MEMBER list + detail success
- Different-team / no-team / empty-assignment / multi-team one-match
- Inactive membership / removed membership
- Archived actor team / archived assignment team
- Cross-workspace team or project
- MEMBER still 403 on POST/PATCH project and assignment
- MEMBER still 403 on brief/strategy mutations (regression)
- Stale JWT does not override DB membership/team (where existing getAdminSessionOrRedirect tests pattern applies to new resolver)
- No regression on 4B.1A assignment PATCH + catalog

## Implementation order

1. Actor resolver + team eligibility validation  
2. Harden `canViewProjectForActor` + list where + tests  
3. Wire GET list + GET detail to project actor (read)  
4. Confirm mutations still manager-gated  
5. Full focused vitest + lint + build  
6. Codex review → fix → commit (when approved)

## Suggested commit message (later)

```text
Add member project authorization foundation
```

## Approval gate

Do not implement until this plan is approved. Next artifact after approval: paste the Cursor implementation prompt and execute Phase 4B.1B without committing until review.
