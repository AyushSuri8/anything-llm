# UsingOpen — System Briefing: What We Own and How It Works

> Fork of AnythingLLM (`AyushSuri8/anything-llm`, branch `usingopen-rebrand`).
> This document is the ownership map: architecture, request flows, plugin
> system, data, and the concrete levers that make this tool ours.

## 1. The machine in one picture

Three Node processes, one SQLite DB, pluggable everything:

- **`server/`** (Express, `:3001`) — the brain. REST API, auth, workspaces,
  chat orchestration, vector-DB management, background jobs, websockets for
  agents. Serves the built frontend as static files.
- **`collector/`** (Express, internal) — the stomach. Document ingestion:
  PDFs, Office docs, URLs, YouTube, audio transcription. Chunks + embeds +
  upserts vectors. Called by the server, never directly by users.
- **`frontend/`** (React + Vite) — the face. SPA calling `/api/*`. All state
  is server-side; the browser holds only session + prefs.
- **Data**: Prisma + SQLite (`server/storage/anythingllm.db`, 30 tables:
  `workspaces`, `workspace_chats`, `workspace_threads`, `users`,
  `system_settings`, `document_vectors`, `model_routers`,
  `model_router_rules`, `scheduled_jobs`, `memories`, `embed_configs`,
  `slash_command_presets`, `system_prompt_variables`, …) + LanceDB vectors
  (default) + `server/storage/` for docs, models, cache, uploads.

## 2. How a chat actually flows

`stream-chat` → `server/utils/chats/stream.js` → workspace settings resolve
provider + model → RAG retrieve (`vectorDbProviders/*` similarity search over
LanceDB) → prompt assembly (system prompt + history + pinned docs +
variables) → provider class in `AiProviders/*` → SSE stream back. Agent mode
instead routes through `aibitat` (the agent harness) with tools as plugins +
a websocket (`agentWebsocket.js`) for live execution updates.

## 3. The plugin architecture (main customization lever)

Everything capabilities-wise is a folder you can copy:

- **38 LLM providers** (`server/utils/AiProviders/`) — each is `index.js` +
  `models.js`. Adding your own = copy `genericOpenAi/`, implement ~4
  methods. Our "UsingOpen Local" is the Ollama provider relabeled.
- **14 embedders** (`server/utils/EmbeddingEngines/`), **11 vector DBs**
  (`server/utils/vectorDbProviders/`) — same pattern, selectable
  per-workspace or globally.
- **~20 agent tools** (`server/utils/agents/aibitat/plugins/`): filesystem,
  SQL, Gmail, Calendar, Outlook, web-browse/scrape, memory, image-gen,
  charting (`rechart.js`), HTTP/websocket, CLI. Each self-registers;
  gating lives in `agentSkillWhitelist`.
- **Model router** (`server/utils/AiProviders/modelRouter/`) — rule-based
  routing across providers; slug rebranded to `usingopen-router` with
  legacy `anythingllm-router` compat (normalize-on-write, accept-on-read).
- **Jobs** (`server/jobs/`): embedding worker, watched-doc sync, scheduled
  jobs runner, memory extraction, Telegram handler, cleanup trio.

## 4. Auth, API, and the outer surface

- Single-user (password-optional) or multi-user with roles; JWT sessions;
  API keys + `/v1/*` developer API (`server/endpoints/api/`) mirroring the
  UI; the embed widget, mobile app, and browser extension all talk to the
  same API — which is why their wire contracts (MIME type, postMessage
  protocol, bundle filenames, mobile header) were intentionally preserved.
- Document flows: upload → collector → chunk → embed → LanceDB; watch/pin
  semantics per workspace.
- Anonymous telemetry has been **fully removed** in this fork (sender
  gutted to a no-op stub, all call sites deleted, Privacy toggle replaced).
  No events, no IDs, no network calls.

## 5. What "ours" still borrows from upstream (independence roadmap)

1. **Model CDN** (`cdn.anythingllm.com`) — native embedder ONNX downloads.
   Self-host a mirror for true independence.
2. **Community Hub API** (`hub.external.anythingllm.com`) — skills/prompts
   marketplace. Keep using theirs or build ours (simple JSON protocol).
3. **Docs / Discord / mobile app / browser extension** — live services;
   mobile + extension need separate forks to rebrand.
4. **`open-computer/`** — a half-built second product (Windows-in-browser
   agent sandbox). Decide: cut it from the fork or adopt it — it doubles
   build and attack surface.

## 6. Suggested ownership roadmap

1. **Defaults**: preconfigure UsingOpen Local + native embedder + LanceDB
   out of the box; ship our own `.env` + onboarding presets so first boot
   is already ours.
2. **Skills**: write 2–3 UsingOpen-native agent tools (e.g. usingopen.com
   docs search, support ticket creator) — proves the plugin path and
   differentiates.
3. **Independence**: mirror the embedder CDN, stub or self-host the hub
   client, remove dead service links.
4. **Build**: get `yarn build` green on CI for the fork (never yet compiled
   post-rebrand) — the recompilation gate before new features land.
5. **Distribution**: our own Docker image name + registry, version scheme,
   changelog; then mobile/extension forks if needed.

## 7. Brand decisions already locked in this fork

- Product: **UsingOpen** · **usingopen.com** · **support@usingopen.com**
- Provider slug `usingopen-router` (legacy accepted); localStorage keys
  `usingopen_*` with one-time boot migration (`storageMigration.js`);
  export filenames `usingopen-*`.
- Outbound identity: `X-Title: UsingOpen`, `X-UsingOpen-UA` skill headers,
  `UsingOpen/<version>` user agent. Gmail/Calendar skill headers renamed —
  those skills pair with upstream Apps Script deployments and will need
  redeploying on our infra.
- Kept deliberately: MIT license attribution, API routes, env var names,
  DB/storage keys for vectors and agent files, all cross-app wire
  contracts, live-service URLs, non-English locale fallbacks where they
  reference Mintplex services (Mobile app, Community Hub).
