/**
 * UsingOpen single-runtime product: on boot, make sure the bundled local
 * model runtime (Ollama-compatible API, shipped by the UsingOpen installer)
 * is selected and reachable without any user configuration.
 *
 * - Defaults LLM_PROVIDER to "ollama" when unset.
 * - Probes the configured or well-known local endpoints for /api/tags.
 * - Pins OLLAMA_BASE_PATH to the first reachable endpoint.
 * - Pins OLLAMA_MODEL_PREF to the first non-embedding model when unset.
 * Process-env only: re-detected on every boot, nothing persisted.
 */
const RUNTIME_CANDIDATES = [
  process.env.OLLAMA_BASE_PATH,
  "http://host.docker.internal:11434",
  "http://127.0.0.1:11434",
  "http://localhost:11434",
].filter(Boolean);

async function probeRuntime(base, timeoutMs = 3000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${base}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function detectLocalRuntime() {
  if (!process.env.LLM_PROVIDER) process.env.LLM_PROVIDER = "ollama";

  let base = process.env.OLLAMA_BASE_PATH || null;
  let tags = base ? await probeRuntime(base) : null;

  if (!tags) {
    for (const candidate of RUNTIME_CANDIDATES) {
      if (candidate === base) continue;
      const found = await probeRuntime(candidate);
      if (found) {
        base = candidate;
        tags = found;
        break;
      }
    }
  }

  if (!base) {
    console.log(
      "UsingOpen runtime: no local model runtime detected. Start the UsingOpen runtime (Ollama-compatible API on :11434) or set OLLAMA_BASE_PATH."
    );
    return;
  }

  process.env.OLLAMA_BASE_PATH = base;
  if (!process.env.OLLAMA_MODEL_PREF) {
    const models = (tags?.models || [])
      .map((model) => model.name)
      .filter((name) => !/embed/i.test(name));
    if (models.length > 0) process.env.OLLAMA_MODEL_PREF = models[0];
  }
  console.log(
    `UsingOpen runtime: detected at ${base} (model: ${
      process.env.OLLAMA_MODEL_PREF || "default"
    })`
  );
}

module.exports = detectLocalRuntime;
