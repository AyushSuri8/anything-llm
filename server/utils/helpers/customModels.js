const {
  fetchOpenRouterEmbeddingModels,
} = require("../EmbeddingEngines/openRouter");
const { ElevenLabsTTS } = require("../TextToSpeech/elevenLabs");
const { getAllLemonadeModels } = require("../AiProviders/lemonade");

const SUPPORT_CUSTOM_MODELS = [
  "ollama",
  "elevenlabs-tts",
  // Image Generation Engines
  // These are suffixed with `-imggen` so that a provider that supports both
  // chat and image generation (eg: ollama) can return only its image-capable
  // models for this key.
  "openai-imggen",
  "openrouter-imggen",
  "ollama-imggen",
  "lemonade-imggen",
  "localai-imggen",
  // Embedding Engines
  "native-embedder",
  "cohere-embedder",
  "openrouter-embedder",
  "lemonade-embedder",
  // STT Engines
  "openai-stt",
  "deepgram-stt",
  "lemonade-stt",
  "groq-stt",
  // TTS Engines
  "kokoro-tts",
];

async function getCustomModels(
  provider = "",
  apiKey = null,
  basePath = null,
  options = {}
) {
  if (!SUPPORT_CUSTOM_MODELS.includes(provider))
    return { models: [], error: "Invalid provider for custom models" };

  switch (provider) {
    case "openai-stt":
      return await openAiSttModels(apiKey);
    case "ollama":
      return await ollamaAIModels(basePath, apiKey);
    case "elevenlabs-tts":
      return await getElevenLabsModels(apiKey);
    case "openai-imggen":
      return await getOpenAiImageModels(apiKey);
    case "openrouter-imggen":
      return await getOpenRouterImageModels();
    case "ollama-imggen":
      return await getOllamaImageModels(basePath, apiKey);
    case "lemonade-imggen":
      return await getLemonadeModels(
        basePath,
        "image",
        unmaskedSecret(apiKey) || process.env.IMAGE_GEN_LEMONADE_API_KEY || null
      );
    case "localai-imggen":
      return await getLocalAiImageModels(basePath, apiKey);
    case "native-embedder":
      return await getNativeEmbedderModels();
    case "cohere-embedder":
      return await getCohereModels(apiKey, "embed");
    case "openrouter-embedder":
      return await getOpenRouterEmbeddingModels();
    case "lemonade-stt":
      return await getLemonadeSTTModels(basePath);
    case "lemonade-embedder":
      return await getLemonadeModels(basePath, "embedding");
    case "deepgram-stt":
      return await getDeepgramSTTModels(apiKey);
    case "groq-stt":
      return await getGroqSTTModels(apiKey);
    case "kokoro-tts":
      return await kokoroTtsVoices(basePath, apiKey);
    default:
      return { models: [], error: "Invalid provider for custom models" };
  }
}


async function openAiSttModels(apiKey = null) {
  const fallback = [
    { id: "whisper-1", name: "whisper-1", organization: "OpenAi" },
    {
      id: "gpt-4o-transcribe",
      name: "gpt-4o-transcribe",
      organization: "OpenAi",
    },
    {
      id: "gpt-4o-mini-transcribe",
      name: "gpt-4o-mini-transcribe",
      organization: "OpenAi",
    },
  ];

  const { OpenAI: OpenAIApi } = require("openai");
  const openai = new OpenAIApi({
    apiKey: apiKey || process.env.OPEN_AI_KEY,
  });

  const allModels = await openai.models
    .list()
    .then((results) => results.data)
    .catch((e) => {
      console.error(`OpenAI:listModels (stt)`, e.message);
      return null;
    });

  if (!allModels) return { models: fallback, error: null };

  // The /v1/models response has no category/type field, so we filter by id.
  // Realtime variants use a separate WebSocket API and are not compatible
  // with the audio.transcriptions.create endpoint we use server-side.
  const models = allModels
    .filter(
      (m) =>
        (m.id.includes("whisper") || m.id.includes("transcribe")) &&
        !m.id.includes("realtime")
    )
    .map((m) => ({ ...m, name: m.id, organization: "OpenAi" }));

  return { models: models.length ? models : fallback, error: null };
}




async function getGroqSTTModels(_apiKey = null) {
  const { OpenAI: OpenAIApi } = require("openai");
  const apiKey =
    _apiKey === true
      ? process.env.STT_GROQ_API_KEY
      : _apiKey || process.env.STT_GROQ_API_KEY || null;

  const openai = new OpenAIApi({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
  });
  const models = (
    await openai.models
      .list()
      .then((results) => results.data)
      .catch((e) => {
        console.error(`GroqSTT:listModels`, e.message);
        return [];
      })
  ).filter((model) => model.id.includes("whisper"));

  // Api Key was successful so lets save it for future uses
  if (models.length > 0 && !!apiKey) process.env.GROQ_STT_API_KEY = apiKey;
  return { models, error: null };
}




async function ollamaAIModels(basePath = null, _authToken = null) {
  let url;
  try {
    let urlPath = basePath ?? process.env.OLLAMA_BASE_PATH;
    new URL(urlPath);
    if (urlPath.split("").slice(-1)?.[0] === "/")
      throw new Error("BasePath Cannot end in /!");
    url = urlPath;
  } catch {
    return { models: [], error: "Not a valid URL." };
  }

  const authToken = _authToken || process.env.OLLAMA_AUTH_TOKEN || null;
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const models = await fetch(`${url}/api/tags`, { headers: headers })
    .then((res) => {
      if (!res.ok)
        throw new Error(`Could not reach Ollama server! ${res.status}`);
      return res.json();
    })
    .then((data) => data?.models || [])
    .then((models) =>
      models.map((model) => {
        return { id: model.name };
      })
    )
    .catch((e) => {
      console.error(e);
      return [];
    });

  // Api Key was successful so lets save it for future uses
  if (models.length > 0 && !!authToken)
    process.env.OLLAMA_AUTH_TOKEN = authToken;
  return { models, error: null };
}









async function getElevenLabsModels(apiKey = null) {
  const models = (await ElevenLabsTTS.voices(apiKey)).map((model) => {
    return {
      id: model.voice_id,
      organization: model.category,
      name: model.name,
    };
  });

  if (models.length === 0) {
    return {
      models: [
        {
          id: "21m00Tcm4TlvDq8ikWAM",
          organization: "premade",
          name: "Rachel (default)",
        },
      ],
      error: null,
    };
  }

  if (models.length > 0 && !!apiKey) process.env.TTS_ELEVEN_LABS_KEY = apiKey;
  return { models, error: null };
}








function getNativeEmbedderModels() {
  const { NativeEmbedder } = require("../EmbeddingEngines/native");
  return { models: NativeEmbedder.availableModels(), error: null };
}


/**
 * List Foundry models for the model picker.
 *
 * Resolves against whichever management surface this host exposes — see the
 * models module for how that is determined and what each one can report.
 * @see {@link ../AiProviders/foundry/models}
 */

/**
 * Get Cohere models
 * @param {string} _apiKey - The API key to use
 * @param {'chat' | 'embed'} type - The type of model to get
 * @returns {Promise<{models: Array<{id: string, organization: string, name: string}>, error: string | null}>}
 */
async function getCohereModels(_apiKey = null, type = "chat") {
  const apiKey =
    _apiKey === true
      ? process.env.COHERE_API_KEY
      : _apiKey || process.env.COHERE_API_KEY || null;

  // Cohere's models endpoint is queried directly so we can keep filtering by
  // endpoint (chat/embed) which the OpenAI-compatible /models route does not support.
  const models = await fetch(
    `https://api.cohere.com/v1/models?page_size=1000&endpoint=${type}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  )
    .then((res) => res.json())
    .then((data) => data?.models || [])
    .then((models) =>
      models.map((model) => ({
        id: model.name,
        name: model.name,
      }))
    )
    .catch((e) => {
      console.error(`Cohere:listModels`, e.message);
      return [];
    });

  return { models, error: null };
}


async function getOpenRouterEmbeddingModels() {
  const knownModels = await fetchOpenRouterEmbeddingModels();
  if (!Object.keys(knownModels).length === 0)
    return { models: [], error: null };

  const models = Object.values(knownModels).map((model) => {
    return {
      id: model.id,
      organization: model.organization,
      name: model.name,
    };
  });
  return { models, error: null };
}

/**
 * Lists the models llmman is serving, via the Ollama API's /api/tags.
 */

async function getLemonadeModels(
  basePath = null,
  task = "chat",
  apiKey = null
) {
  try {
    const models = await getAllLemonadeModels(basePath, task, apiKey);
    return { models, error: null };
  } catch (e) {
    console.error(`Lemonade:getLemonadeModels`, e.message);
    return { models: [], error: "Could not fetch Lemonade Models" };
  }
}

async function getLemonadeSTTModels(basePath = null) {
  try {
    const models = await getAllLemonadeModels(basePath, "transcription");
    return { models, error: null };
  } catch (e) {
    console.error(`Lemonade:getLemonadeSTTModels`, e.message);
    return { models: [], error: "Could not fetch Lemonade STT Models" };
  }
}


/**
 * Get Deepgram STT models from the Management API.
 * https://api.deepgram.com/v1/models returns { stt: [...], tts: [...] }.
 * @param {string} _apiKey - Deepgram API key. Falls back to STT_DEEPGRAM_API_KEY.
 * @returns {Promise<{models: Array<{id: string, name: string, organization: string}>, error: string | null}>}
 */
async function getDeepgramSTTModels(_apiKey = null) {
  const apiKey =
    _apiKey === true
      ? process.env.STT_DEEPGRAM_API_KEY
      : _apiKey || process.env.STT_DEEPGRAM_API_KEY || null;
  if (!apiKey)
    return { models: [], error: "No Deepgram API key was provided." };

  try {
    const response = await fetch("https://api.deepgram.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!response.ok) throw new Error(`Deepgram returned ${response.status}`);

    let models = new Map();
    const data = await response.json();
    (data?.stt ?? [])
      .filter((m) => m.batch !== false)
      .forEach((m) => {
        if (models.has(m.canonical_name)) return;
        models.set(m.canonical_name, {
          id: m.canonical_name,
          name: m.canonical_name,
          organization: "Deepgram",
        });
      });

    models = Array.from(models.values());
    // Api Key was successful so lets save it for future uses
    if (models.length > 0 && _apiKey) process.env.STT_DEEPGRAM_API_KEY = apiKey;
    return { models, error: null };
  } catch (e) {
    console.error(`Deepgram:getDeepgramSTTModels`, e.message);
    return { models: [], error: "Could not fetch Deepgram STT models" };
  }
}

/**
 * Get Privatemode models
 * @param {string} basePath - The base path of the Privatemode endpoint.
 * @param {'any' | 'generate' | 'embed' | 'transcribe'} task - The task to fetch the models for.
 * @returns {Promise<{models: Array<{id: string, organization: string, name: string}>, error: string | null}>}
 */

/**
 * Get SambaNova models
 * @param {string} _apiKey - The API key to use
 * @returns {Promise<{models: Array<{id: string, organization: string, name: string}>, error: string | null}>}
 */

/**
 * Use the Cerebras PUBLIC API to fetch the public models
 * @returns {Promise<{models: Array<{id: string, organization: string, name: string}>, error: string | null}>}
 */
async function getCerebrasModels() {
  try {
    const models = await fetch("https://api.cerebras.ai/public/v1/models")
      .then((response) => response.json())
      .then(({ data = [] }) => {
        return data.map((model) => ({
          id: model.id,
          name: model.name,
          organization: model.owned_by ?? "Cerebras",
        }));
      })
      .catch((error) => {
        console.error(`Cerebras:listModels`, error.message);
        return [];
      });
    return { models, error: null };
  } catch (e) {
    console.error(`Cerebras:getCerebrasModels`, e.message);
    return { models: [], error: "Could not fetch Cerebras Models" };
  }
}


/**
 * Pulls the live voice list from a self-hosted kokoro-fastapi server's
 * /audio/voices endpoint. basePath is the OpenAI-compatible base URL the
 * user pointed at their kokoro instance (e.g. http://localhost:8880/v1).
 * @param {string} basePath - The base path to the Kokoro instance.
 * @param {string} apiKey - The API key to use.
 * @returns {Promise<{models: Array<{id: string, organization: string, name: string}>, error: string | null}>}
 */
async function kokoroTtsVoices(basePath = null, apiKey = null) {
  let endpoint = basePath || process.env.TTS_KOKORO_ENDPOINT;
  if (!endpoint)
    return { models: [], error: "No Kokoro endpoint was provided." };

  endpoint = new URL(endpoint);
  endpoint.pathname = "/v1/audio/voices";
  const headers = { "Content-Type": "application/json" };
  const key = typeof apiKey === "boolean" ? null : apiKey;
  if (key) headers.Authorization = `Bearer ${key}`;

  const voices = await fetch(endpoint.toString(), { method: "GET", headers })
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText || "Failed to load voices");
      return res.json();
    })
    .then((data) => (Array.isArray(data?.voices) ? data.voices : []))
    .catch((e) => {
      console.error(`Kokoro:listVoices`, e.message);
      return null;
    });

  if (!voices || !Array.isArray(voices))
    return { models: [], error: "Could not fetch Kokoro voices." };

  // kokoro-fastapi < 0.3.x returns voices as plain id strings while >= 0.3.x
  // returns { id, name } objects. Normalize both shapes to { id, name } so the
  // voice list renders regardless of the kokoro-fastapi version being used.
  const models = voices
    .map((voice) => {
      if (typeof voice === "string")
        return { id: voice, name: voice, organization: "Kokoro" };
      if (voice && typeof voice === "object" && voice.id)
        return {
          id: voice.id,
          name: voice.name || voice.id,
          organization: "Kokoro",
        };
      return null;
    })
    .filter(Boolean);
  return { models, error: null };
}

/**
 * Get AWS Bedrock models
 * @param {string} _apiKey - The API key to use
 * @param {Object} options - The options to use
 * @param {string} [options.region] - The region to use
 * @returns {Promise<{models: Array<{id: string, organization: string, name: string}>, error: string | null}>}
 */
