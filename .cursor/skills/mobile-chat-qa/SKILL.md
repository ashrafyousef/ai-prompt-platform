---
name: mobile-chat-qa
description: Mobile-first QA workflow for the AI Workspace chat UI. Use when checking /chat responsiveness, composer behavior, sidebar behavior, model selector placement, message readability, attachments, and failed/retry states before team testing.
---

# Mobile Chat QA

## Purpose

Validate and safely polish the AI Workspace chat experience on mobile devices without changing backend behavior or unrelated UI.

**Before any edit:** read and inspect the relevant chat UI files (see [Where to look in this repo](#where-to-look-in-this-repo)). Prefer **minimal Tailwind and layout** adjustments. After mobile fixes, **verify desktop** at a wide viewport (for example 1280px or 1440px) so responsive behavior is preserved.

## Scope

Inspect and, only after approval, patch visible mobile issues in:

- chat page layout
- mobile sidebar/drawer behavior
- composer spacing and keyboard-safe behavior
- message bubble width and long response readability
- model selector dropdown placement
- image attachment preview behavior
- failed assistant cards and retry visibility
- dark mode mobile appearance

Touch **only** the files needed for the reported mobile issue; do not broaden refactors.

## Where to look in this repo

Read-only orientation (typical entry points):

- Route shell: `app/(app)/chat/page.tsx`
- Layout, composer, sidebar, messages, model UI: `components/chat/ChatLayout.tsx`, `ChatComposer.tsx`, `ChatSidebar.tsx`, `ModelSelector.tsx`, `MessageList.tsx`, `ChatClient.tsx`

## Hard constraints

- Do not change database schema.
- Do not change API behavior.
- Do not change auth logic.
- Do not change model governance logic.
- Do not refactor unrelated components.
- Do not alter desktop layout unless needed to preserve responsive behavior.
- Keep patches small and reversible.
- Prefer Tailwind/layout changes over component rewrites.
- Do **not** edit `app/api/**`, server routes, migrations, auth modules, model policy, or shared types that affect APIs—**except** for read-only inspection when understanding behavior.

## Required workflow

Execute in order:

1. **Baseline git state** — Before any change:

   ```bash
   git status --short
   ```

2. **Inspect before editing** — Run or inspect:

   ```bash
   git status --short
   git log --oneline -10
   find .cursor -maxdepth 3 -type f 2>/dev/null
   ```

   Then open the relevant files under `components/chat/` and `app/(app)/chat/page.tsx` for the specific issue (read-only until a patch plan is approved).

3. **Patch plan (required before edits)** — Write a short markdown plan: which files, which Tailwind/layout tweaks, why it fixes mobile, and how desktop stays unchanged. **Wait for explicit user approval** before modifying code.

4. **Implement** — Apply minimal layout/Tailwind changes within scope. Do not expand into backend, schema, governance, or API layers.

5. **Post-change git state** — After edits:

   ```bash
   git status --short
   ```

   Confirm the working tree only includes the intended UI files.

6. **Verify** — Run through the [QA checklist](#qa-checklist-viewport-widths) at iPhone and Android widths, then smoke-check **desktop** at 1280px or 1440px.

## QA checklist (viewport widths)

Use browser devtools responsive mode. Safe-area / notch behavior is best-effort in devtools; note gaps for real-device follow-up.

### iPhone widths

| Viewport | Notes |
|----------|--------|
| 390×844 | iPhone 13 / 14 / 15 class |
| 430×932 | Pro Max class |

**Checks (each width):**

- [ ] Sidebar / drawer opens and closes without trapping focus or leaving a dead overlay
- [ ] Composer: padding, send/stop controls reachable; keyboard overlap mitigated where applicable
- [ ] Message bubbles: max-width, wrapping, long unbroken strings (URLs, tokens) scroll or break sensibly
- [ ] Model selector: placement, overflow, z-index above content
- [ ] Image attachments: preview size, tap targets, no horizontal page scroll
- [ ] Failed assistant state: error copy readable; retry / dismiss visible and tappable
- [ ] Dark mode: contrast and borders remain clear

### Android widths

| Viewport | Notes |
|----------|--------|
| 360×800 | Common smaller phone |
| 412×915 | Pixel-like |

Repeat the same **Checks** list at each Android width.

### Desktop regression (required)

After mobile passes, at **1280** or **1440** width:

- [ ] Sidebar and main content match prior desktop behavior (no unintended mobile-only styles leaking wide)

## Red flags — stop and report

If the correct fix would require any of the following, **do not patch**; summarize the finding and options for the team:

- API route or response shape changes
- Database or schema changes
- Auth or session changes
- Model governance / policy logic changes
- Large component rewrites when a small layout change would suffice
