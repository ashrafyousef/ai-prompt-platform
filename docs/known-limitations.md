# Known Limitations (Beta)

Documented constraints and deferred work for the current beta. Share this with testers so expectations align with what is implemented today.

---

## Infrastructure and deployment

### Custom domain / DNS may still be recovering after renewal

If the production custom domain was recently renewed or DNS records changed, propagation can take time. Symptoms include intermittent sign-in redirects, stale certificates, or Vercel preview URLs working while the custom domain does not. Use the Vercel deployment URL for beta if the custom domain is not fully stable.

### Vercel Blob required for production image uploads

On Vercel (and typical serverless production), chat image uploads require a Blob store and `BLOB_READ_WRITE_TOKEN`. Without it, uploads fail with a configuration error. Create the store in Vercel → Storage and redeploy after env vars are set.

### Local uploads use `public/uploads`

When `IMAGE_UPLOAD_LOCAL=1` (or local dev defaults), images are written to `public/uploads`. This path is suitable for local development only—not for multi-instance or serverless production. OpenAI vision calls use base64 for local paths; remote Blob URLs are passed through for production.

---

## Agents and product identity

### Nur display name is in DB/admin; internal slug remains `lumex`

Testers see **Nur** (or whatever name admins set) in the UI. The codebase default agent slug is still `lumex` (`lib/chatDefaultAgent.ts`). Admin URLs, seeds, and some logs may reference `lumex`. Do not rename the slug in beta without a coordinated migration plan.

### Nur does not generate images

Nur is a **creative direction and prompt** assistant. It can analyze uploaded reference images and produce copy-ready prompts, but it does not call an image generation API (DALL·E, etc.). Requests like “create the image” should receive a clarification, not a generated asset.

---

## Chat UI and routing

### Context Drawer is desktop `lg+` only

The conversation context drawer (agent summary, model section, attachment thumbnails) is available from **`lg` breakpoint (1024px) and up**. It is intentionally hidden on tablet/phone; mobile users rely on the sidebar, composer, and agent selector instead.

### Auto / Suggest routing still needs clearer product explanation

**Manual**, **Auto**, and **Suggest** routing modes exist in the composer, but in-product copy explaining when each mode applies is limited. Beta testers may not understand why the model changed between turns. Default expectation: **Manual** unless your workspace standardizes Auto/Suggest.

---

## Models, keys, and limits

### Model availability depends on env keys, role, and usage limits

Which models appear and work depends on:

- **`OPENAI_API_KEY` / `GROQ_API_KEY`** — missing keys disable or fallback provider models.
- **`CHAT_ENABLED_MODEL_IDS`** — optional allowlist; unlisted registry models are hidden.
- **Role governance** — some models are TEAM_LEAD / ADMIN only.
- **`TOKEN_SOFT_LIMIT` / budget warnings** — heavy usage may warn or block sends.

A model shown as disabled in the selector includes a reason when the API provides one.

### GPT-5 family parameter constraints

GPT-5 models omit custom **temperature** in API requests (provider rejects non-default values). Creative “temperature” on the agent still applies to other models; GPT-5 behavior is less tunable via that knob.

### Large images may hit platform or server limits

Images are limited to 4 MB each and compressed client-side before upload. Slow networks or provider vision fetches can still fail, so images under ~2 MB remain preferable for reliable beta testing. Failures may show a specific “could not read the attached image” message after recent error-handling improvements.

### Conversation context trimming

Chat history sent to the model is trimmed by a token budget (`CHAT_CONTEXT_TOKEN_LIMIT`, default 2500 for history portion). Very long threads may lose early context even though the full thread remains visible in the UI.

---

## Observability and performance

### Speed Insights branches exist but are not merged

Experimental Speed Insights / performance instrumentation may exist on unmerged branches. Production beta builds do not assume Speed Insights dashboards or alerts are active.

---

## Architecture and admin (deferred)

### Workspace / team architecture review is deferred

Multi-team scoping, workspace boundaries, and long-term org structure are not finalized for beta. Test with the workspace and roles you have today; do not assume enterprise multi-tenant behavior is complete.

### Admin surface scope

Admin agent editing, knowledge links, and governance env vars are powerful but not all flows are polished for non-technical admins. Prefer a small set of trained admins for Nur configuration during beta.

---

## Error messages and support

### Provider errors are summarized for users

Server logs retain structured provider error fields (`error.param`, `error.code`, etc.) for debugging. Users see safe, mapped messages—not raw JSON. Some rare 400 responses may still fall back to a generic “provider rejected this request” message.

### Rate limits

Shared workspace API keys can hit provider rate limits (429). Users should wait briefly, avoid parallel sends, or switch models.

---

## Related docs

- Beta test procedure: [`beta-qa-checklist.md`](./beta-qa-checklist.md)
- Environment reference: [`.env.example`](../.env.example)
