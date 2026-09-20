/**
 * UsingOpen native agent skill: runtime-manager.
 * Lets agents inspect and manage the bundled local model runtime
 * (Ollama-compatible API) that ships with the UsingOpen installer:
 * status overview, installed models, per-model info, and unloading
 * models from memory. Read-mostly by design - model installs happen
 * via the installer, not from inside a chat.
 */

const RUNTIME_ACTIONS = ["status", "list-models", "model-info", "unload-model"];

function runtimeBase() {
  const base =
    process.env.OLLAMA_BASE_PATH || "http://127.0.0.1:11434";
  return base.replace(/\/$/, "");
}

function runtimeHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (process.env.OLLAMA_AUTH_TOKEN)
    headers["Authorization"] = `Bearer ${process.env.OLLAMA_AUTH_TOKEN}`;
  return headers;
}

async function runtimeGet(path) {
  const response = await fetch(`${runtimeBase()}${path}`, {
    headers: runtimeHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`Runtime API ${path} responded ${response.status}`);
  return await response.json();
}

async function runtimeDelete(path) {
  const response = await fetch(`${runtimeBase()}${path}`, {
    method: "DELETE",
    headers: runtimeHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok && response.status !== 404)
    throw new Error(`Runtime API ${path} responded ${response.status}`);
  return true;
}

const runtimeManager = {
  name: "runtime-manager",
  startupConfig: {
    params: {},
  },
  plugin: function () {
    return {
      name: this.name,
      setup(aibitat) {
        aibitat.function({
          super: aibitat,
          name: this.name,
          description:
            "Inspect and manage the local UsingOpen model runtime. Check runtime status and loaded models, list installed models, show details for a model, or unload a model from memory to free resources. Model installs are handled by the UsingOpen installer, not through this tool.",
          examples: [
            {
              prompt: "Is the local runtime healthy and what is loaded?",
              call: JSON.stringify({ action: "status" }),
            },
            {
              prompt: "What models are installed locally?",
              call: JSON.stringify({ action: "list-models" }),
            },
            {
              prompt: "Show me details about qwen3.5:4b",
              call: JSON.stringify({
                action: "model-info",
                model: "qwen3.5:4b",
              }),
            },
            {
              prompt: "Unload qwen3.5:4b from memory to free RAM",
              call: JSON.stringify({
                action: "unload-model",
                model: "qwen3.5:4b",
              }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: RUNTIME_ACTIONS,
                description:
                  "'status' for runtime health + loaded models, 'list-models' for installed models, 'model-info' for details on one model, 'unload-model' to unload one model from memory.",
              },
              model: {
                type: "string",
                description:
                  "Model name (eg qwen3.5:4b). Required for model-info and unload-model.",
              },
            },
            required: ["action"],
            additionalProperties: false,
          },
          handler: async function ({ action, model = null }) {
            if (!RUNTIME_ACTIONS.includes(action))
              throw new Error(
                `Unknown runtime action '${action}'. Valid: ${RUNTIME_ACTIONS.join(", ")}`
              );

            if (action === "status") {
              const [tags, ps] = await Promise.all([
                runtimeGet("/api/tags").catch((e) => ({ error: e.message })),
                runtimeGet("/api/ps").catch((e) => ({ error: e.message })),
              ]);
              if (tags?.error)
                throw new Error(
                  `UsingOpen runtime is not reachable at ${runtimeBase()}: ${tags.error}`
                );
              return JSON.stringify(
                {
                  base: runtimeBase(),
                  installed_models: (tags.models || []).map((m) => m.name),
                  loaded_models: (ps.models || []).map((m) => ({
                    name: m.name,
                    size_vram: m.size_vram,
                    until: m.expires_at,
                  })),
                },
                null,
                2
              );
            }

            if (action === "list-models") {
              const tags = await runtimeGet("/api/tags");
              return JSON.stringify(
                (tags.models || []).map((m) => ({
                  name: m.name,
                  size: m.size,
                  modified: m.modified_at,
                })),
                null,
                2
              );
            }

            if (!model)
              throw new Error(`A model name is required for '${action}'.`);

            if (action === "model-info") {
              const response = await fetch(`${runtimeBase()}/api/show`, {
                method: "POST",
                headers: runtimeHeaders(),
                body: JSON.stringify({ model }),
                signal: AbortSignal.timeout(15_000),
              }).catch(() => null);
              if (response?.ok)
                return JSON.stringify(await response.json(), null, 2);
              const tags = await runtimeGet("/api/tags");
              const found = (tags.models || []).find((m) => m.name === model);
              if (!found) throw new Error(`Model '${model}' is not installed.`);
              return JSON.stringify(found, null, 2);
            }

            // unload-model: DELETE /api/delete would remove it from disk -
            // we only want it out of memory, so generate with keep_alive=0.
            await fetch(`${runtimeBase()}/api/generate`, {
              method: "POST",
              headers: runtimeHeaders(),
              body: JSON.stringify({ model, keep_alive: 0 }),
              signal: AbortSignal.timeout(30_000),
            }).catch((e) => {
              throw new Error(`Failed to unload '${model}': ${e.message}`);
            });
            return `Model '${model}' unloaded from memory.`;
          },
        });
      },
    };
  },
};

module.exports = { runtimeManager };
