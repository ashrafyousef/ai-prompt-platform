# Beta 1.2 — Task Domain Foundation (Phase 2B)

Planning doc only. No schema or UI implemented here.

## Product direction (confirmed)

- Task-first, not agent-first
- **Brief Intake** is the pilot workflow
- **Brief Specialist** is the first workflow-facing agent (not built yet)
- **Start Work** is the future entry point (not built yet)
- Teams and Clients are parallel under Workspace
- Teams connect to Projects through assignments
- Form-based clarification for intake/planning; conversation for strategy/creative/Nur CD review
- No node workflow UI, multi-agent orchestration, or vector RAG in this phase

## Current schema support

| Area | Status | Notes |
|------|--------|-------|
| Workspace | Exists | Top-level container with members, teams, agents, knowledge |
| Team | Exists | `workspaceId`, slug, archive flag |
| WorkspaceMember | Exists | `OWNER` / `ADMIN` / `MEMBER`; optional single `teamId` |
| AgentConfig | Exists | Workspace-scoped; `GLOBAL` or `TEAM`; status draft/published |
| KnowledgeItem | Exists | Workspace + optional `teamId`; `appliesTo` string (no Client FK) |
| ChatSession | Exists | User-scoped only; no project/brief link |
| Client | Missing | — |
| Project | Missing | — |
| ProjectTeamAssignment | Missing | — |
| Brief | Missing | — |
| BriefQuestion / BriefClarification | Missing | — |

## Recommended minimal foundation

### Add now (schema + migration, no UI yet)

**Client**

- Purpose: parallel entity under Workspace; Projects usually reference one Client
- Fields: `id`, `workspaceId`, `name`, `slug`, `isArchived`, timestamps
- Optional later: `brandNotes` text (defer separate Brand model)
- Migration: yes | UI: wait

**Project**

- Purpose: anchor for Brief Intake and team assignments
- Fields: `id`, `workspaceId`, `clientId` (nullable FK), `name`, `slug`, `status` enum (`DRAFT` / `ACTIVE` / `ARCHIVED`), timestamps
- Migration: yes | UI: wait

**ProjectTeamAssignment**

- Purpose: many-to-many Team ↔ Project without changing member `teamId`
- Fields: `id`, `projectId`, `teamId`, `createdAt`; unique `[projectId, teamId]`
- Migration: yes | UI: wait

### Add with Brief Intake implementation (next branch after foundation)

**Brief**

- Purpose: one intake record per project (or versioned later)
- Fields: `id`, `projectId`, `title`, `status` (`DRAFT` / `SUBMITTED` / `IN_REVIEW` / `COMPLETE`), `submittedAt`, timestamps
- Migration: yes when intake ships | UI: with Brief Intake

**Brief responses (defer separate table initially)**

- Store form answers as `Brief.responsesJson` (JSON) until question schema stabilizes
- Add `BriefQuestion` / `BriefClarification` tables only when form builder needs relational queries

**Brief Specialist agent**

- New `AgentConfig` baseline (draft until intake UI exists); slug e.g. `brief-specialist`
- No orchestration layer; invoked from intake routes later

### Defer

- **Brand** as separate model — use Client + knowledge `appliesTo` / tags until multi-brand per client is required
- **Task** model — Brief + Project status covers pilot scope
- **ChatSession.projectId** — link when Start Work opens project-scoped chat threads
- **Vector RAG** — keep current knowledge injection
- **Node workflow UI** — out of scope
- **Multi-workspace selector** — already deferred in `resolveWorkspaceAccessForUser`

## Access / permissions (future helpers)

Current: `resolveWorkspaceAccessForUser` + `WorkspaceMember.teamId` + `adminAuth` team-scoped admin rules.

When Projects/Clients ship:

- **OWNER / workspace-wide ADMIN**: list all clients and projects in workspace
- **Team-scoped ADMIN**: clients/projects visible if any assigned team matches `auth.teamId`
- **MEMBER**: same team-assignment filter; no cross-team project access by default
- **ProjectTeamAssignment** does not require changing single `teamId` membership design

## Start Work placement (future)

- Recommended route: **`/work`** under `app/(app)/work/`
- `/chat` remains default home (`app/page.tsx` redirect); chat-first UX unchanged
- Start Work hub: create/select project → start brief intake → optional link to conversational review in `/chat`
- Avoid `/briefs/new` as primary entry (too narrow for future task types)
- Admin Clients/Projects CRUD can live under `/admin/clients`, `/admin/projects` later

## Safe implementation sequence

1. **This branch** — inspection + planning docs only (done)
2. **Next branch** — Prisma models Client, Project, ProjectTeamAssignment + migration on beta DB only
3. **Following** — access helpers + admin list APIs (no end-user UI)
4. **Then** — Brief model + Brief Specialist agent + Brief Intake UI + Start Work route
