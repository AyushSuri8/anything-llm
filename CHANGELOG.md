# Changelog

All notable changes to the UsingOpen fork are documented here.
Upstream history lives in the parent project; only fork divergences are listed.

## [Unreleased]

### Added
- Single-runtime product: the app ships with and auto-detects the bundled
  UsingOpen model runtime (Ollama-compatible API) on boot — no LLM provider
  configuration required.
- `server/utils/boot/detectLocalRuntime.js`: probes the configured endpoint,
  then host-gateway and loopback candidates, pins `OLLAMA_BASE_PATH` and a
  default model when unset.
- Native `runtime-manager` agent skill (status, list-models, model-info,
  unload-model), default-enabled.
- One-time `anythingllm_*` → `usingopen_*` localStorage migration on
  frontend boot (`storageMigration.js`).
- `USINGOPEN.md` ownership and architecture briefing.

### Changed
- Product identity: UsingOpen (`usingopen.com`, `support@usingopen.com`)
  across UI copy (all 36 locales), titles, login, onboarding, assets,
  docs, and package metadata.
- LLM provider label `Ollama` → `UsingOpen Local`; native embedder and
  transcriber labels → `UsingOpen ...`.
- Model-router provider slug `anythingllm-router` → `usingopen-router`
  (legacy slug accepted on all read paths, migrated on write).
- Agent class `AnythingLLMModelRouter` → `UsingOpenModelRouter`;
  `getAnythingLLMUserAgent` → `getUsingOpenUserAgent`; outbound
  `X-Title`, `X-SearchApi-Source`, and skill `X-UsingOpen-UA` headers.
- Provider allowlist restricted to `ollama` + router slugs;
  `getLLMProvider` falls back to `ollama`.
- Help-docs base URL → `usingopen.com`.
- Docker image workflow renamed; builds on `master` and
  `usingopen-rebrand`.
- Default contact/support email → `support@usingopen.com` everywhere,
  including onboarding survey, privacy page, security policy, and
  contributing guide.

### Removed
- Anonymous telemetry: Mintplex PostHog sender, all call sites, boot
  banners, Privacy toggle, README/TERMS sections.
- Community Hub: server model/endpoints/middleware, frontend pages,
  publish flows, sidebar section, routes, URL helpers.
- Onboarding survey exfiltration (local-only completion).
- Model CDN mirror fallback (HuggingFace-direct downloads only).
- ARM Chromium vendor mirror from Dockerfiles.
- Mintplex Discord footer entry and hosted-checkout link.
- Frontend provider lists reduced to the single runtime (78 dead
  imports pruned); agent providers limited to `ollama`.

### Kept deliberately (contracts & law)
- MIT license attribution and Mintplex entity notices.
- API routes, env var names, DB/storage keys for vectors and agent files.
- Cross-app wire contracts: `application/anythingllm-document` MIME,
  embed bundle + postMessage protocol, mobile device-token header,
  `anythingllm_vectors` table default, `anythingllm-fs` directory.
- Live-service references that still work: docs deep links, Community Hub
  and Mobile product names where they name Mintplex services.
