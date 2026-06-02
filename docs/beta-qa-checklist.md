# Beta QA Checklist

Use this checklist before team or external beta testing of the AI Workspace. Test in **Production** (or a staging deployment that mirrors production env vars) unless a section explicitly says local dev is acceptable.

Record pass/fail, browser/device, and notes in the sign-off section at the bottom.

---

## Before testing

- [ ] Confirm deployment is the intended beta build (check commit SHA or Vercel deployment URL).
- [ ] Confirm `NEXTAUTH_URL` matches the live site URL exactly.
- [ ] Confirm `DATABASE_URL` points at the intended Neon/database (not a stale or local DB).
- [ ] Confirm at least one LLM provider key is set (`OPENAI_API_KEY` and/or `GROQ_API_KEY`).
- [ ] For production image uploads: confirm Vercel Blob is configured and `BLOB_READ_WRITE_TOKEN` is present.
- [ ] Optional: note `CHAT_ENABLED_MODEL_IDS`, `CHAT_DEFAULT_MODEL_ID`, and `TOKEN_SOFT_LIMIT` if overridden from defaults.
- [ ] Use a modern browser (Chrome, Safari, or Edge). Keep one incognito/private session for fresh sign-up tests.
- [ ] Have a small test image ready (JPEG/PNG, under ~2 MB) and one larger image (5–10 MB) for limit checks.

---

## Auth and workspace

- [ ] **Sign up** — new account completes registration without errors.
- [ ] **Sign in** — existing user can sign in; session persists on refresh.
- [ ] **Sign out** — user returns to sign-in; protected routes redirect appropriately.
- [ ] **Forgot / reset password** — email flow works if enabled in your environment.
- [ ] **Workspace access** — user without a workspace sees the no-workspace state (not a blank crash).
- [ ] **Invite flow** — accept-invite works for a test invitation (if beta includes invites).
- [ ] **Unauthorized** — visiting `/admin` as a non-admin shows unauthorized, not a server error.

---

## Chat core

- [ ] **New chat** — creating a session works; sidebar lists the new conversation.
- [ ] **Send message** — user message appears; assistant streams a reply.
- [ ] **Stop / cancel** — in-flight generation can be cancelled without leaving a stuck “streaming” card.
- [ ] **History** — reload page; prior messages load in order with correct roles.
- [ ] **Rename / delete session** — sidebar actions work and persist after refresh.
- [ ] **Edit user message** — edit flow resends and produces a new assistant reply (if used in beta).
- [ ] **Regenerate** — regenerate on an assistant message produces a new attempt.
- [ ] **Retry failed turn** — after a forced failure, retry shows a new attempt (not a duplicate user bubble).
- [ ] **Failed assistant card** — error title + detail are readable; retry button works when shown.
- [ ] **Share link** — shared conversation opens read-only (if enabled for beta testers).

---

## Nur text behavior

Nur is the primary creative assistant. Display name comes from admin/DB; internal slug remains `lumex`.

- [ ] **Agent selection** — Nur appears in the agent selector with correct name and description from admin.
- [ ] **Starter prompts** — starter chips populate the composer or send as expected.
- [ ] **“Who is Nur?”** — short, natural reply (no forced `## Result` / `## Details` wrappers).
- [ ] **“Thanks” / “ok” / “perfect”** — brief conversational reply; no forced markdown section templates.
- [ ] **“Can you create a storyboard?”** — helpful natural reply or structured creative guidance as appropriate (not empty error).
- [ ] **“Can you create the image?” (text-only)** — capability clarification (Nur helps with prompts/direction, not image generation); **no provider 400** when using GPT-5.4 Mini or default model.
- [ ] **Creative task** — e.g. “Analyze this image and improve the creative direction” (with image attached) returns structured creative sections when the task warrants it (Creative direction, Prompt strategy, Final prompt, etc.), driven by Nur’s system prompt—not legacy forced headings on every turn.
- [ ] **Follow-up in thread** — short acknowledgements after a long creative turn still get natural replies.

---

## Nur image upload and image analysis

- [ ] **Attach image (composer +)** — preview appears; image sends with the message.
- [ ] **Production upload** — uploaded image URL is a Vercel Blob (or expected public URL), not a broken `/uploads/` path on Vercel.
- [ ] **Local dev (optional)** — with `IMAGE_UPLOAD_LOCAL=1`, uploads land under `public/uploads` and display in-thread.
- [ ] **Vision model** — with an image attached, a vision-capable model is selected (or composer warns if model lacks vision).
- [ ] **Image analysis prompt** — Nur responds with creative direction / prompt guidance referencing the image content.
- [ ] **Re-upload after failure** — if an image read error occurs, re-uploading a smaller image succeeds.
- [ ] **Context drawer thumbnails** — images from the thread appear in the drawer (up to six) on desktop.

---

## Model selector and routing

- [ ] **Model list** — `/api/models` governed list loads; disabled models show reason where applicable.
- [ ] **Manual routing** — selected model is used for the turn (check route meta or assistant model label if visible).
- [ ] **Auto routing** — with routing set to Auto, a compatible model is chosen without user selection errors.
- [ ] **Suggested routing** — Suggest mode behaves as expected (user pick when valid; fallback when not).
- [ ] **Vision gate** — attaching an image disables or warns on non-vision models before send.
- [ ] **Agent constraints** — agent-required capabilities (if configured) block incompatible models with a clear message.
- [ ] **GPT-5.4 Mini** — chat completes without temperature-related provider errors on normal prompts.
- [ ] **Provider errors** — if a failure is reproduced, UI shows a **specific** message when applicable (model settings, context too long, image read failure)—not only the generic “prompt, image, or model” line.

---

## Context Drawer desktop behavior

Context Drawer is **desktop `lg+` only** (1024px and wider).

- [ ] **Toggle visibility** — drawer toggle appears at `lg+` in the chat header; hidden below `lg`.
- [ ] **Open / close** — drawer opens as a right-side panel without breaking main chat layout.
- [ ] **Agent context** — agent name, description, and model section reflect current agent and governed models.
- [ ] **Model in drawer** — model selector in drawer respects governance (disabled reasons, vision hints).
- [ ] **Image thumbnails** — recent thread attachments shown when present.
- [ ] **No mobile drawer** — below `lg`, confirm drawer toggle is not shown (mobile uses sidebar/composer patterns instead).

---

## Mobile QA

Test at **390×844** (iPhone class) and **360×800** (Android class). Re-check **1280×800** desktop after mobile passes.

- [ ] **Mobile sidebar** — opens/closes; no trapped overlay or horizontal page scroll.
- [ ] **Composer** — placeholder, send button, and attachment control are reachable; text area grows sensibly.
- [ ] **Keyboard** — typing in composer does not permanently hide send/stop controls (best-effort in devtools; note real-device gaps).
- [ ] **Message bubbles** — user bubbles capped width; assistant messages wrap long URLs and markdown without breaking layout.
- [ ] **Model selector** — dropdown fits viewport; z-index above messages; disabled/hint states readable.
- [ ] **Image previews** — attachment thumbnails sized correctly; remove control tappable.
- [ ] **Streaming / failed states** — “Generating…” and failed cards readable; retry tappable.
- [ ] **Dark mode** — contrast and borders acceptable on mobile.
- [ ] **Agent selector** — searchable list usable on small screens.

---

## Admin QA (if applicable)

Skip if beta testers are **USER** role only.

- [ ] **Admin access** — ADMIN (or TEAM_LEAD where allowed) reaches `/admin` overview.
- [ ] **Agents list** — Nur/lumex agent visible with correct published state.
- [ ] **Agent edit** — name, description, system prompt, starter prompts, output config save without error.
- [ ] **Nur output config** — `requiredSections` empty (or as intended); response depth standard; no legacy forced sections in DB config.
- [ ] **Agent test** — admin test route returns a response for Nur with sample input.
- [ ] **Members / teams / knowledge** — smoke-test CRUD paths used in your beta scope.
- [ ] **Model governance env** — changes to enabled models (if any) reflect in chat after redeploy.

---

## Sign-off

| Area | Tester | Date | Pass / Fail | Notes |
|------|--------|------|-------------|-------|
| Before testing | | | | |
| Auth and workspace | | | | |
| Chat core | | | | |
| Nur text behavior | | | | |
| Nur image upload & analysis | | | | |
| Model selector and routing | | | | |
| Context Drawer (desktop) | | | | |
| Mobile QA | | | | |
| Admin QA | | | | |

**Beta readiness decision**

- [ ] **Ready for beta** — all critical paths pass on production-like config.
- [ ] **Ready with caveats** — see `docs/known-limitations.md` and list blockers below.
- [ ] **Not ready** — list blockers:

**Blockers / follow-ups**

1.
2.
3.

**Tested deployment URL:**

**Git commit / deployment ID:**

**Sign-off name & role:**
