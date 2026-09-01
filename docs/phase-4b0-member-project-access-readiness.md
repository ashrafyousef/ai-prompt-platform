# Phase 4B.0 — Member Project Access Readiness

**Verdict: Not ready**

Read-only architecture and security audit · branch `next/beta-1.2` @ `c3016c4` · baseline tests 12 files / 138 passed · worktree clean at audit time

## Verdict

The proposed matching-team MEMBER contract is implementable without a Prisma migration, but it is not safe to enable yet. Outer gates still deny all MEMBERs from `/projects` and project APIs; project team assignment is create-only (no edit/remove UI or PATCH); `canViewProjectForActor` ignores archived teams; and agent–knowledge injection does not revalidate scope at runtime — Phase 4B.K is required before member-owned project chats.

| Signal | Status |
|---|---|
| Schema multi-team | Yes |
| HTTP MEMBER path | Dead |
| Project team edit | Missing |
| 4B.K before chats | Required |

---

## Part 1 — Domain model

| # | Question | Answer |
|---|---|---|
| 1 | Teams per project | Zero, one, or many via `ProjectTeamAssignment` |
| 2 | Join model | M:N Project ↔ Team through `ProjectTeamAssignment` |
| 3 | Unique constraints | `@@unique([projectId, teamId])`; Project `@@unique([workspaceId, slug])` |
| 4 | Delete behavior | Project/Team delete Cascades assignments; Team delete SetNull on `WorkspaceMember.teamId` |
| 5 | Project with no team | Yes — assignments optional |
| 6 | MEMBER with no team | Yes — `WorkspaceMember.teamId` nullable |
| 7 | Member.teamId same workspace? | No DB constraint; create/update APIs validate `workspaceId` + `!isArchived` |
| 8 | Cross-workspace project↔team? | Schema allows; `POST /api/admin/projects` rejects teams outside workspace |
| 9 | Auth team field | `WorkspaceMember.teamId` (manager paths); `AuthorizedUserContext` may fall back to `User.teamId` |
| 10 | Legacy fields | `User.teamId` and `User.role` still exist; JWT may cache `teamId` |
| 11 | Migration for 4B contract? | No — schema + `canViewProjectForActor` already support it |
| 12 | Archived teams | `Team.isArchived` boolean — not consulted by `canViewProjectForActor` |

---

## Part 2 — Project–team cardinality

### Schema

- Supports 0 / 1 / N teams. Unique `(projectId, teamId)`.
- Cascade on project/team delete. No workspace-consistency DB check on the join table.

### Authorization

- MEMBER succeeds if **any** assigned team matches `actor.teamId`.
- Multi-team with one match → allow.
- None match / empty assignments / no `actor.teamId` → deny.
- Archived assignments are **not** filtered.

### API

- Create accepts `teamIds[]` (max 20). Workspace + active-team validated. Empty allowed (manager-only projects).
- No project PATCH for team reassignment or removal. Assignments are **create-only** today.

### UI + Beta data

- Multi-checkbox only on `/admin/projects` create.
- Phase 4A redirected admin detail — no post-create assignment UI.
- Beta DB unreachable from the audit environment — zero / one / multi counts not verified live.

### Cardinality conclusion

Multiple-team schema exists mainly for future flexibility; API create accepts arrays, but UI/API cannot manage assignments after create — effectively create-only multi-team / operationally one-team workflows.

---

## Part 3 — Existing project authorization

Actor shape for `canViewProjectForActor`:

```ts
{ workspaceId, workspaceRole, platformRole, teamId }
```

### Actor behavior

| Actor | Behavior |
|---|---|
| OWNER | Workspace-wide viewer (any project in workspace) |
| Platform ADMIN | Workspace-wide viewer (via `platformRole === ADMIN`) |
| Workspace ADMIN, no team | Workspace-wide viewer |
| Workspace ADMIN with team | Team-match only (same branch as MEMBER) |
| MEMBER | Team-match only; no `teamId` → deny; empty assignments → deny |

### Checks

| Check | Status |
|---|---|
| Workspace identity | Yes — first guard |
| Active membership | Yes — `resolveWorkspaceAccessForUser` `isActive: true` |
| Actor team | Yes when not workspace-wide |
| Project team assignments | Yes — `includes(actor.teamId)` |
| Project with no team fails closed for MEMBER | Yes |
| MEMBER with no team fails closed | Yes in `canView`; ambiguous if `User.teamId` fallback used |
| Archived teams considered | No |
| MEMBER HTTP production call sites | None — manager gate first |
| Unit coverage | Match / different / no-team / empty / multi / cross-ws tested; archived-team + inactive path incomplete in `projectAccess.test` |

### Role / team ambiguity

Platform role (`User.role`), workspace role (`WorkspaceMember.role`), and legacy `User.teamId` coexist. Manager APIs use `WorkspaceMember.teamId` only. `requireAuthorizedUserContext` falls back to `user.teamId` — **Phase 4B must not use that fallback for project visibility.**

---

## Part 4 — Beta database readiness

**Beta access unavailable**

`DATABASE_URL` was present via `.env`, but the Neon host was unreachable from the audit environment. Membership, team, project cardinality, visibility simulation against live rows, and Part 6 AgentKnowledge data classification could not be completed. Re-run Parts 4 and 6 when the Beta DB is reachable.

**Logic simulation** (code-path, not live rows):

- Matching team → allow
- Different / none / empty project → deny
- Multi with one match → allow
- Cross-workspace → deny
- Inactive → denied before `canView`
- Archived `teamId` on actor currently still matches if that ID remains on assignments (**gap**)

---

## Part 5 — Agent and knowledge exposure

| # | Question | Finding |
|---|---|---|
| 1 | `ProjectKnowledgePanel` | Static placeholder only — no live data |
| 2 | Project detail payload | No `AgentConfig` / `KnowledgeItem` records |
| 3 | Agents MEMBER sees | `GET /api/agents`: PUBLISHED+enabled GLOBAL + own-team TEAM in workspace |
| 4 | `canViewAgentForActor` in chat | Yes — `/api/agents` and send path |
| 5 | GLOBAL agent | Yes for MEMBER |
| 6 | Other team TEAM agent | Denied by `canViewAgentForActor` |
| 7 | Project-team affects agents? | No |
| 8 | Injected KnowledgeItems | All active linked items via `resolveEffectiveAgentKnowledge` — no actor/team filter |
| 9 | `buildEffectiveAgentConfig` context | Agent record only — no actor / workspace / team args |
| 10 | Runtime link revalidation | No — `isActive` + truncation only |
| 11 | Scope enforcement | Soft write-time stamp from agent; no hard runtime — effectively neither for fail-closed |
| 12 | Cross-team via bad link | Yes — if MEMBER can select the agent, inconsistent knowledge can inject |
| 13 | Telemetry to browser | Chat SSE: no knowledge body; agents list returns knowledge count via `countEffectiveAgentKnowledge` |
| 14 | Unsafe link vectors | Admin UI, import, scope change leaving stale links, API/migrations |
| 15 | Tests before member chats | Write-time reject + runtime reject + GLOBAL/TEAM null semantics + no cross-ws/team inject |

### Phase 4B boundary

- Do **not** introduce Knowledge Resolution Foundation in 4B.
- Keep Knowledge Context **placeholder-only**.
- Do **not** ship member project chats until agent–knowledge scope safety is enforced or proven sufficient (**4B.K**).

---

## Part 6 — Agent–knowledge data consistency

**Unable to verify — Beta database access unavailable**

Even if Beta links are clean today, the current mechanism remains unsafe: runtime injection does not revalidate AgentKnowledge workspace/team compatibility. **Write-time and runtime enforcement are both required.**

---

## Part 7 — Administrative configuration

### Member → team

- `PATCH /api/admin/members/[memberId]` — assign, reassign, or clear (`teamId: null`).
- Invitations accept optional `teamId`; validated same workspace + not archived.
- Cross-workspace rejected server-side.

### Project → team

- Assign only at create via `/admin/projects` + `POST /api/admin/projects` (`teamIds[]`).
- Existing projects cannot be edited/removed via API/UI.
- Empty teams allowed intentionally (manager-only).
- **Prerequisite:** reliable assignment edit/remove before enabling MEMBER access.

---

## Part 8 — Endpoint permission matrix

Current guard for project-domain routes is manager-only (`requireWorkspaceMemberManagerContext`). The **Proposed MEMBER** column is the Phase 4B contract, not current behavior.

| Endpoint | Method | Current | Data / action | Proposed MEMBER |
|---|---|---|---|---|
| `/api/admin/projects` | GET | Manager | List projects | Matching-team MEMBER read |
| `/api/admin/projects` | POST | Manager | Create + assign teams/client | Manager only |
| `/api/admin/projects/[id]` | GET | Manager | Project metadata + panels payload | Matching-team MEMBER read |
| Project update / archive / assign | — | N/A or manager-only admin | Mutate project / teams / client | Manager only (needs design if no PATCH yet) |
| `/api/admin/projects/[id]/chats` | GET | Manager | Project-linked chats (owner-filtered today for managers) | Matching-team MEMBER own-resource |
| `/api/chat/new?projectId` | POST | Manager gate when `projectId` set | Create linked chat | Matching-team MEMBER own-resource |
| `/api/admin/briefs` | GET/POST | Manager | Read / create brief | GET: matching-team read · POST: Manager only |
| `/api/admin/briefs/[id]` | PATCH | Manager | Save / submit / approve / reopen | Denied to MEMBER |
| `/api/admin/briefs/[id]/analyze` | POST | Manager | Analyze brief | Denied to MEMBER |
| `/api/admin/projects/[id]/strategy` | GET/POST | Manager | Read / create strategy | GET: matching-team read · POST: Manager only |
| `/api/admin/strategies/[id]` | PATCH | Manager | Edit / workflow / Ready for Creative | Denied to MEMBER |
| `/api/agents` | GET | Authorized user + `canViewAgent` | Agent selector | Needs design decision (no broaden) |
| `/api/admin/agents*` | * | Manager | Agent admin / config / test | Denied to MEMBER |
| `/api/admin/knowledge*` | * | Manager | Knowledge admin | Denied to MEMBER |
| `/admin/*` | UI | Manager | Admin console | Denied to MEMBER |
| `/projects` layout + middleware | page | Manager (`getAdminSessionOrRedirect`) | Route shell | Needs redesign for active MEMBER |

---

## Part 9 — UI permission matrix

| Control | MEMBER UI treatment |
|---|---|
| New project chat | Show after 4B.3 + 4B.K; server-gated |
| Project administration / assign client-team | Hide — manager only |
| Brief raw input / Save / Analyze / Submit / Approve / Reopen | Hide or disabled read-only; APIs deny |
| Strategy create / edit / workflow / Ready for Creative | Hide — manager only |
| Approved handoff / Strategy direction | Read-only display |
| Knowledge Context panel | Keep placeholder-only |
| Suggested actions | Filter to allowed actions only |
| Agent selector | Existing agent scope rules; no project-driven broaden |

**UI mechanism:** server-computed capabilities object on project GET (e.g. `canRead`, `canMutateBrief`, `canCreateChat`), shared helpers in panels. Hidden buttons are not security — APIs remain authoritative.

---

## Part 10 — Recommended implementation split

### 4B.1 — Project Access Authorization Foundation

Shared DB-backed active-member actor (`WorkspaceMember.teamId` only); list filtering; matching-team auth; GET vs mutation separation; comprehensive tests. Soften middleware/layout gates without enabling mutations. Prerequisite: project team assignment edit/remove for admins.

### 4B.2 — Member Read-Only Project Workspace

`/projects` for matching-team MEMBER; list + detail; read-only brief / handoff / strategy. Managers unchanged. Admin stays manager-only.

### 4B.K — Agent–Knowledge Scope Hardening (**required**)

Write-time + runtime fail-closed validation for AgentKnowledge (workspace, team, scope, archived). Regression tests. No Knowledge Resolution Foundation. Required before 4B.3 even if Beta data looks clean.

### 4B.3 — Member-Owned Project Chats

Own linked chats only; create for accessible projects; preserve private ownership; no project context injection / memory / new knowledge resolution.

**Sequence:** 4B.1 → 4B.2 → 4B.K → 4B.3. Do not reorder: chats without 4B.K risk cross-team knowledge via injectable agents.

---

## Part 11 — Required future tests

### Visibility & detail

- OWNER / ADMIN / platform ADMIN policies
- Matching vs different team
- MEMBER / project no-team
- Multi-team partial match
- Cross-workspace
- Inactive membership
- Archived / invalid team
- Direct URL cannot bypass list filtering

### Mutations

- MEMBER denied for project / brief / strategy mutations
- Managers retain current behavior

### Chats

- Own-only list / create
- Cannot see another user’s linked chats
- Cannot create for inaccessible projects

### Agent / knowledge / routes

- Agent selection scope
- AgentKnowledge write + runtime reject
- Null / global semantics
- Telemetry does not expose restricted data
- `/projects` allowed only after Phase 4B; `/admin` remains denied
- Stale JWT loses to current DB membership / team

---

## Baseline validation

**138 / 138 passed**

```bash
npx vitest run \
  tests/projectAccess.test.ts \
  tests/getAdminSessionOrRedirect.test.ts \
  tests/projectsLayoutGuard.test.ts \
  tests/adminProjectDetailRoute.test.ts \
  tests/adminProjectChatsRoute.test.ts \
  tests/adminClientProjectRoutes.test.ts \
  tests/adminBriefRoutes.test.ts \
  tests/adminBriefPatchRoute.test.ts \
  tests/adminStrategyRoutes.test.ts \
  tests/agentScope.test.ts \
  tests/knowledgeInjection.test.ts \
  tests/chatSendRoute.knowledgeInjection.test.ts
```

---

## Prerequisites before enabling MEMBER access

1. Auth outer-gate redesign (4B.1)
2. Admin edit/remove project team assignments
3. Explicit archived-team fail-closed policy in `canViewProjectForActor`
4. Never use `User.teamId` fallback for project access
5. 4B.K before any member project chats
