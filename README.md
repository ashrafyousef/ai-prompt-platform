# AI Prompt Platform (MVP)

Monolithic Next.js + PostgreSQL platform for controlled prompt engineering with:
- chat sessions and history
- configurable AI agents
- text + image input
- backend prompt orchestration
- streaming responses to the UI

## Tech Stack
- Next.js App Router + TypeScript
- Prisma + PostgreSQL
- NextAuth (credentials-based MVP sign-in)
- OpenAI chat completions API

## Setup
1. Copy environment file:
   - `cp .env.example .env.local`
2. Update values in `.env.local`.
3. Install dependencies:
   - `npm install`
4. Generate Prisma client:
   - `npm run prisma:generate`
5. Run migrations:
   - `npm run prisma:migrate`
6. Seed default agent configurations:
   - `npm run prisma:seed`
7. Start development server:
   - `npm run dev`

## Implemented Endpoints
- `POST /api/chat/send`
- `POST /api/chat/new`
- `GET /api/chat/history`
- `POST /api/upload/image`
- `GET /api/agents`
- `POST /api/prompts/save`

## Smoke Test Checklist
1. Open `/chat`, click `Sign in as demo user`.
2. Click `New Chat`.
3. Send text prompt and verify streamed assistant response.
4. Upload image with a prompt and verify request succeeds.
5. Switch agent and verify behavior/output style changes.
6. Use `Copy`, `Regenerate`, and `Edit` controls.
7. Refresh page and verify history persists.

## Notes
- If `OPENAI_API_KEY` is missing, assistant returns a clear configuration message.
- Rate limiting is enforced in-memory per user for MVP.
- Long-term memory and vector retrieval are intentionally left as phase-2 extensions.
