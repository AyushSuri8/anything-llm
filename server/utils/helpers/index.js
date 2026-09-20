/**
 * File Attachment for automatic upload on the chat container page.
 * @typedef Attachment
 * @property {string} name - the given file name
 * @property {string} mime - the given file mime
 * @property {string} contentString - full base64 encoded string of file
 */

/**
 * @typedef {Object} ResponseMetrics
 * @property {number} prompt_tokens - The number of prompt tokens used
 * @property {number} completion_tokens - The number of completion tokens used
 * @property {number} total_tokens - The total number of tokens used
 * @property {number} outputTps - The output tokens per second
 * @property {number} duration - The duration of the request in seconds
 *
 * @typedef {Object} ChatMessage
 * @property {string} role - The role of the message sender (e.g. 'user', 'assistant', 'system')
 * @property {string} content - The content of the message
 *
 * @typedef {Object} ChatCompletionResponse
 * @property {string} textResponse - The text response from the LLM
 * @property {ResponseMetrics} metrics - The response metrics
 *
 * @typedef {Object} ChatCompletionOptions
 * @property {number} temperature - The sampling temperature for the LLM response
 * @property {import("@prisma/client").users} user - The user object for the chat completion to send to the LLM provider for user tracking (optional)
 *
 * @typedef {function(Array<ChatMessage>, ChatCompletionOptions): Promise<ChatCompletionResponse>} getChatCompletionFunction
 *
 * @typedef {function(Array<ChatMessage>, ChatCompletionOptions): Promise<import("./chat/LLMPerformanceMonitor").MonitoredStream>} streamGetChatCompletionFunction
 */

/**
 * @typedef {Object} BaseLLMProvider - A basic llm provider object
 * @property {string} className - Provider identifier used in logs and response metrics.
 * @property {string} model - The active model name for this provider instance.
 * @property {number} defaultTemp - Default sampling temperature (typically 0.7).
 * @property {Function} streamingEnabled - Checks if streaming is enabled for chat completions.
 * @property {Function} promptWindowLimit - Returns the token limit for the current model.
 * @property {Function} isValidChatCompletionModel - Validates if the provided model is suitable for chat completion.
 * @property {Function} constructPrompt - Constructs a formatted prompt for the chat completion request.
 * @property {getChatCompletionFunction} getChatCompletion - Gets a chat completion response.
 * @property {streamGetChatCompletionFunction} streamGetChatCompletion - Streams a chat completion response.
 * @property {Function} handleStream - Handles the streaming response.
 * @property {Function} embedTextInput - Embeds the provided text input using the specified embedder.
 * @property {Function} embedChunks - Embeds multiple chunks of text using the specified embedder.
 * @property {Function} compressMessages - Compresses chat messages to fit within the token limit.
 */

/**
 * @typedef {Object} BaseLLMProviderClass - Class method of provider - not instantiated
 * @property {function(string): number} promptWindowLimit - Returns the token limit for the provided model.
 */

/**
 * @typedef {Object} BaseVectorDatabaseProvider
 * @property {string} name - The name of the Vector Database instance.
 * @property {Function} connect - Connects to the Vector Database client.
 * @property {Function} totalVectors - Returns the total number of vectors in the database.
 * @property {Function} namespaceCount - Returns the count of vectors in a given namespace.
 * @property {Function} similarityResponse - Performs a similarity search on a given namespace.
 * @property {Function} rerankedSimilarityResponse - Performs a similarity search on a given namespace with reranking (if supported by provider).
 * @property {Function} namespace - Retrieves the specified namespace collection.
 * @property {Function} hasNamespace - Checks if a namespace exists.
 * @property {Function} namespaceExists - Verifies if a namespace exists in the client.
 * @property {Function} deleteVectorsInNamespace - Deletes all vectors in a specified namespace.
 * @property {Function} deleteDocumentFromNamespace - Deletes a document from a specified namespace.
 * @property {Function} addDocumentToNamespace - Adds a document to a specified namespace.
 * @property {Function} performSimilaritySearch - Performs a similarity search in the namespace.
 */

/**
 * @typedef {Object} BaseEmbedderProvider
 * @property {string} model - The model used for embedding.
 * @property {number} maxConcurrentChunks - The maximum number of chunks processed concurrently.
 * @property {number} embeddingMaxChunkLength - The maximum length of each chunk for embedding.
 * @property {Function} embedTextInput - Embeds a single text input.
 * @property {Function} embedChunks - Embeds multiple chunks of text.
 */

/**
 * Gets the systems current vector database provider.
 * @param {('pinecone' | 'chroma' | 'chromacloud' | 'lancedb' | 'weaviate' | 'qdrant' | 'milvus' | 'zilliz' | 'astra') | null} getExactly - If provided, this will return an explit provider.
 * @returns { BaseVectorDatabaseProvider}
 */
function getVectorDbClass(getExactly = null) {
  const vectorSelection = getExactly ?? process.env.VECTOR_DB ?? "lancedb";
  switch (vectorSelection) {
    case "pinecone":
      const { Pinecone } = require("../vectorDbProviders/pinecone");
      return new Pinecone();
    case "chroma":
      const { Chroma } = require("../vectorDbProviders/chroma");
      return new Chroma();
    case "chromacloud":
      const { ChromaCloud } = require("../vectorDbProviders/chromacloud");
      return new ChromaCloud();
    case "lancedb":
      const { LanceDb } = require("../vectorDbProviders/lance");
      return new LanceDb();
    case "weaviate":
      const { Weaviate } = require("../vectorDbProviders/weaviate");
      return new Weaviate();
    case "qdrant":
      const { QDrant } = require("../vectorDbProviders/qdrant");
      return new QDrant();
    case "milvus":
      const { Milvus } = require("../vectorDbProviders/milvus");
      return new Milvus();
    case "zilliz":
      const { Zilliz } = require("../vectorDbProviders/zilliz");
      return new Zilliz();
    case "astra":
      const { AstraDB } = require("../vectorDbProviders/astra");
      return new AstraDB();
    case "pgvector":
      const { PGVector } = require("../vectorDbProviders/pgvector");
      return new PGVector();
    default:
      console.error(
        `\x1b[31m[ENV ERROR]\x1b[0m No VECTOR_DB value found in environment! Falling back to LanceDB`
      );
      const { LanceDb: DefaultLanceDb } = require("../vectorDbProviders/lance");
      return new DefaultLanceDb();
  }
}

/**
 * Returns the LLMProvider with its embedder attached via system or via defined provider.
 * @notice Use resolveProviderConnector instead as this function DOES NOT handle the usingopen-router provider.
 * You should only use this function if you are absolutely sure you are not using the usingopen-router provider ever in your code.
 * @param {{provider: string | null, model: string | null} | null} params - Initialize params for LLMs provider
 * @returns {BaseLLMProvider}
 */
const ROUTER_PROVIDER = "usingopen-router";
const LEGACY_ROUTER_PROVIDER = "anythingllm-router";
function normalizeRouterProvider(provider) {
  if (provider === LEGACY_ROUTER_PROVIDER) return ROUTER_PROVIDER;
  return provider;
}
function isRouterProvider(provider) {
  return provider === ROUTER_PROVIDER || provider === LEGACY_ROUTER_PROVIDER;
}
function getLLMProvider({ provider = null, model = null } = {}) {
  const LLMSelection = provider ?? process.env.LLM_PROVIDER ?? "ollama";
  const embedder = getEmbeddingEngineSelection();

  switch (LLMSelection) {
    case "ollama":
      const { OllamaAILLM } = require("../AiProviders/ollama");
      return new OllamaAILLM(embedder, model);
    case ROUTER_PROVIDER:
    case LEGACY_ROUTER_PROVIDER:
      // Model router is handled separately in stream.js via UsingOpenModelRouter.
      // This case should not be hit directly - if it is, throw a descriptive error.
      throw new Error(
        "usingopen-router provider must be resolved via UsingOpenModelRouter class, not getLLMProvider directly."
      );
    default:
      throw new Error(
        `ENV: No valid LLM_PROVIDER value found in environment! Using ${process.env.LLM_PROVIDER}`
      );
  }
}

/**
 * Returns the EmbedderProvider by itself to whatever is currently in the system settings.
 * @returns {BaseEmbedderProvider}
 */
function getEmbeddingEngineSelection() {
  const { NativeEmbedder } = require("../EmbeddingEngines/native");
  const engineSelection = process.env.EMBEDDING_ENGINE;
  switch (engineSelection) {
    case "openai":
      const { OpenAiEmbedder } = require("../EmbeddingEngines/openAi");
      return new OpenAiEmbedder();
    case "azure":
      const {
        AzureOpenAiEmbedder,
      } = require("../EmbeddingEngines/azureOpenAi");
      return new AzureOpenAiEmbedder();
    case "localai":
      const { LocalAiEmbedder } = require("../EmbeddingEngines/localAi");
      return new LocalAiEmbedder();
    case "ollama":
      const { OllamaEmbedder } = require("../EmbeddingEngines/ollama");
      return new OllamaEmbedder();
    case "native":
      return new NativeEmbedder();
    case "lmstudio":
      const { LMStudioEmbedder } = require("../EmbeddingEngines/lmstudio");
      return new LMStudioEmbedder();
    case "cohere":
      const { CohereEmbedder } = require("../EmbeddingEngines/cohere");
      return new CohereEmbedder();
    case "voyageai":
      const { VoyageAiEmbedder } = require("../EmbeddingEngines/voyageAi");
      return new VoyageAiEmbedder();
    case "litellm":
      const { LiteLLMEmbedder } = require("../EmbeddingEngines/liteLLM");
      return new LiteLLMEmbedder();
    case "mistral":
      const { MistralEmbedder } = require("../EmbeddingEngines/mistral");
      return new MistralEmbedder();
    case "generic-openai":
      const {
        GenericOpenAiEmbedder,
      } = require("../EmbeddingEngines/genericOpenAi");
      return new GenericOpenAiEmbedder();
    case "gemini":
      const { GeminiEmbedder } = require("../EmbeddingEngines/gemini");
      return new GeminiEmbedder();
    case "openrouter":
      const { OpenRouterEmbedder } = require("../EmbeddingEngines/openRouter");
      return new OpenRouterEmbedder();
    case "lemonade":
      const { LemonadeEmbedder } = require("../EmbeddingEngines/lemonade");
      return new LemonadeEmbedder();
    default:
      return new NativeEmbedder();
  }
}

/**
 * Returns the configured image generation provider instance.
 * Selected system-wide via the IMAGE_GEN_PROVIDER env, mirroring the
 * embedder/vector-db subsystem selection.
 * @returns {import("../ImageGenerators/base").BaseImageGenerator}
 */
function getImageGeneratorProvider() {
  const provider = process.env.IMAGE_GEN_PROVIDER;
  switch (provider) {
    case "openai":
      const { OpenAiImageGenerator } = require("../ImageGenerators/openAi");
      return new OpenAiImageGenerator();
    case "ollama":
      const { OllamaImageGenerator } = require("../ImageGenerators/ollama");
      return new OllamaImageGenerator();
    case "lemonade":
      const { LemonadeImageGenerator } = require("../ImageGenerators/lemonade");
      return new LemonadeImageGenerator();
    case "localai":
      const { LocalAiImageGenerator } = require("../ImageGenerators/localAi");
      return new LocalAiImageGenerator();
    case "openrouter":
      const {
        OpenRouterImageGenerator,
      } = require("../ImageGenerators/openRouter");
      return new OpenRouterImageGenerator();
    default:
      throw new Error(
        `No valid image generation provider was set. Got: ${provider}`
      );
  }
}

/**
 * Returns the LLMProviderClass - this is a helper method to access static methods on a class
 * @param {{provider: string | null} | null} params - Initialize params for LLMs provider
 * @returns {BaseLLMProviderClass}
 */
function getLLMProviderClass({ provider = null } = {}) {
  switch (provider) {
    case "ollama":
      const { OllamaAILLM } = require("../AiProviders/ollama");
      return OllamaAILLM;
    case ROUTER_PROVIDER:
    case LEGACY_ROUTER_PROVIDER:
      const { UsingOpenModelRouter } = require("../AiProviders/modelRouter");
      return UsingOpenModelRouter;
    default:
      return null;
  }
}

/**
 * Returns the defined model (if available) for the given provider.
 * @param {{provider: string | null} | null} params - Initialize params for LLMs provider
 * @returns {string | null}
 */
function getBaseLLMProviderModel({ provider = null } = {}) {
  switch (provider) {
    case "ollama":
      return process.env.OLLAMA_MODEL_PREF;
    default:
      return null;
  }
}

// Some models have lower restrictions on chars that can be encoded in a single pass
// and by default we assume it can handle 1,000 chars, but some models use work with smaller
// chars so here we can override that value when embedding information.
function maximumChunkLength() {
  if (
    !!process.env.EMBEDDING_MODEL_MAX_CHUNK_LENGTH &&
    !isNaN(process.env.EMBEDDING_MODEL_MAX_CHUNK_LENGTH) &&
    Number(process.env.EMBEDDING_MODEL_MAX_CHUNK_LENGTH) > 1
  )
    return Number(process.env.EMBEDDING_MODEL_MAX_CHUNK_LENGTH);

  return 1_000;
}

function toChunks(arr, size) {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_v, i) =>
    arr.slice(i * size, i * size + size)
  );
}

/**
 * Report chunk-level embedding progress from any embedder.
 * Works in both the child worker process (IPC via process.send) and the
 * main server process (direct SSE emit via EmbeddingWorkerManager).
 *
 * Requires `global.__embeddingProgress` to be set by the caller with
 * { workspaceSlug, filename, userId }.
 *
 * @param {number} chunksProcessed
 * @param {number} totalChunks
 */
function reportEmbeddingProgress(chunksProcessed, totalChunks) {
  if (!global.__embeddingProgress) return;
  const ctx = global.__embeddingProgress;
  const event = {
    type: "chunk_progress",
    workspaceSlug: ctx.workspaceSlug,
    filename: ctx.filename,
    userId: ctx.userId,
    chunksProcessed,
    totalChunks,
    silent: true,
  };

  if (typeof process.send === "function") {
    try {
      process.send(event);
    } catch {}
    return;
  }

  const { emitProgress } = require("../EmbeddingWorkerManager");
  emitProgress(ctx.workspaceSlug, event);
}

function humanFileSize(bytes, si = false, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + " B";
  }

  const units = si
    ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(dp) + " " + units[u];
}

/**
 * Async wrapper that resolves the correct LLM connector for a workspace,
 * handling the usingopen-router provider transparently. Callers get back
 * a ready-to-use connector without needing to know about routing internals.
 *
 * @param {Object} opts
 * @param {Object} opts.workspace - The workspace record (required)
 * @param {string} [opts.prompt] - The current user prompt
 * @param {Object|null} [opts.user] - The user object
 * @param {Object|null} [opts.thread] - The thread object
 * @param {Object[]} [opts.attachments] - Attachments array
 * @param {Object|null} [opts.chatHistoryOverride] - Pre-fetched chat history
 * @param {number|null} [opts.messageCountOverride] - Override for message count
 * @param {string|null} [opts.apiSessionId] - API session scope
 * @returns {Promise<{connector: BaseLLMProvider, routingMetadata: Object|null, prefetchedContext: Object|null}>}
 */
async function resolveProviderConnector({
  workspace,
  prompt = "",
  user = null,
  thread = null,
  attachments = [],
  chatHistoryOverride = null,
  messageCountOverride = null,
  apiSessionId = null,
}) {
  const effectiveProvider = workspace?.chatProvider || process.env.LLM_PROVIDER;

  if (!isRouterProvider(effectiveProvider)) {
    return {
      connector: getLLMProvider({
        provider: workspace?.chatProvider,
        model: workspace?.chatModel,
      }),
      routingMetadata: null,
      prefetchedContext: null,
    };
  }

  const { UsingOpenModelRouter } = require("../AiProviders/modelRouter");
  const { ModelRouterService } = require("../router");

  const routerWorkspace = workspace?.router_id
    ? workspace
    : {
        ...workspace,
        router_id: process.env.MODEL_ROUTER_ID
          ? Number(process.env.MODEL_ROUTER_ID)
          : null,
      };

  const router = new UsingOpenModelRouter(routerWorkspace);
  const ctx = await ModelRouterService.gatherRoutingContext({
    workspace,
    user,
    thread,
    message: prompt,
    chatHistoryOverride,
    messageCountOverride,
    apiSessionId,
  });

  await router.resolve(
    {
      prompt,
      conversationTokenCount: ctx.conversationTokenCount,
      conversationMessageCount: ctx.conversationMessageCount,
      attachments,
    },
    { user, thread }
  );

  return {
    connector: router.delegateProvider,
    routingMetadata: router.routingMetadata,
    prefetchedContext: ctx,
  };
}

/**
 * Strips thought/thinking tags from text (e.g., <thinking>...</thinking>)
 * Useful for cleaning LLM responses before sending notifications.
 * @param {string} text - The text to strip thoughts from.
 * @returns {string} - The text with thought tags and their content removed.
 */
const THOUGHT_KEYWORDS = ["thought", "thinking", "think", "thought_chain"];
const THOUGHT_REGEX_COMPLETE = new RegExp(
  THOUGHT_KEYWORDS.map(
    (keyword) =>
      `<${keyword}\\s*(?:[^>]*?)?\\s*>[\\s\\S]*?<\\/${keyword}\\s*(?:[^>]*?)?>`
  ).join("|"),
  "gi"
);

function stripThinkingFromText(text = "") {
  return text.replace(THOUGHT_REGEX_COMPLETE, "").trim();
}

module.exports = {
  getEmbeddingEngineSelection,
  getImageGeneratorProvider,
  maximumChunkLength,
  getVectorDbClass,
  getLLMProviderClass,
  getBaseLLMProviderModel,
  getLLMProvider,
  resolveProviderConnector,
  toChunks,
  humanFileSize,
  reportEmbeddingProgress,
  stripThinkingFromText,
  ROUTER_PROVIDER,
  LEGACY_ROUTER_PROVIDER,
  normalizeRouterProvider,
  isRouterProvider,
};
