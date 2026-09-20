const path = require("path");
const fs = require("fs");
const { toChunks, reportEmbeddingProgress } = require("../../helpers");
const { v4 } = require("uuid");
const { SUPPORTED_NATIVE_EMBEDDING_MODELS } = require("./constants");

class NativeEmbedder {
  static defaultModel = "Xenova/all-MiniLM-L6-v2";

  // ONNX sessions cannot be freed on onnxruntime-node 1.14 (dispose() is a
  // no-op), so we must only ever create one pipeline per model.
  /** @type {Map<string, any>} */
  static #pipelines = new Map();
  /** @type {Map<string, Promise<any>>} */
  static #pipelinePromises = new Map();

  /**
   * Supported embedding models for native.
   * @type {Record<string, {
   *   chunkPrefix: string;
   *   queryPrefix: string;
   *   apiInfo: {
   *     id: string;
   *     name: string;
   *     description: string;
   *     lang: string;
   *     size: string;
   *     modelCard: string;
   *   };
   * }>}
   */
  static supportedModels = SUPPORTED_NATIVE_EMBEDDING_MODELS;

  // UsingOpen downloads embedding models directly from HuggingFace. No mirror fallback.

  constructor() {
    this.className = "NativeEmbedder";
    this.model = this.getEmbeddingModel();
    this.modelInfo = this.getEmbedderInfo();
    this.cacheDir = path.resolve(
      process.env.STORAGE_DIR
        ? path.resolve(process.env.STORAGE_DIR, `models`)
        : path.resolve(__dirname, `../../../storage/models`)
    );
    this.modelPath = path.resolve(this.cacheDir, ...this.model.split("/"));
    this.modelDownloaded = fs.existsSync(this.modelPath);

    // Limit of how many strings we can process in a single pass to stay with resource or network limits
    this.maxConcurrentChunks = this.modelInfo.maxConcurrentChunks;
    this.embeddingMaxChunkLength = this.modelInfo.embeddingMaxChunkLength;

    // Make directory when it does not exist in existing installations
    if (!fs.existsSync(this.cacheDir)) fs.mkdirSync(this.cacheDir);
    this.log(`Initialized ${this.model}`);
  }

  log(text, ...args) {
    console.log(`\x1b[36m[${this.className}]\x1b[0m ${text}`, ...args);
  }

  /**
   * Get the selected model from the environment variable.
   * @returns {string}
   */
  static _getEmbeddingModel() {
    const envModel =
      process.env.EMBEDDING_MODEL_PREF ?? NativeEmbedder.defaultModel;
    if (NativeEmbedder.supportedModels?.[envModel]) return envModel;
    return NativeEmbedder.defaultModel;
  }

  get embeddingPrefix() {
    return NativeEmbedder.supportedModels[this.model]?.chunkPrefix || "";
  }

  get queryPrefix() {
    return NativeEmbedder.supportedModels[this.model]?.queryPrefix || "";
  }

  /**
   * Get the available models in an API response format
   * we can use to populate the frontend dropdown.
   * @returns {{id: string, name: string, description: string, lang: string, size: string, modelCard: string}[]}
   */
  static availableModels() {
    return Object.values(NativeEmbedder.supportedModels).map(
      (model) => model.apiInfo
    );
  }

  /**
   * Get the embedding model to use.
   * We only support a few models and will default to the default model if the environment variable is not set or not supported.
   *
   * Why only a few? Because we need to mirror them on the CDN so non-US users can download them.
   * eg: "Xenova/all-MiniLM-L6-v2"
   * eg: "Xenova/nomic-embed-text-v1"
   * @returns {string}
   */
  getEmbeddingModel() {
    const envModel =
      process.env.EMBEDDING_MODEL_PREF ?? NativeEmbedder.defaultModel;
    if (NativeEmbedder.supportedModels?.[envModel]) return envModel;
    return NativeEmbedder.defaultModel;
  }

  /**
   * Get the embedding model info.
   *
   * Will always fallback to the default model if the model is not supported.
   * @returns {Object}
   */
  getEmbedderInfo() {
    const model = this.getEmbeddingModel();
    return NativeEmbedder.supportedModels[model];
  }

  #tempfilePath() {
    const filename = `${v4()}.tmp`;
    const tmpPath = process.env.STORAGE_DIR
      ? path.resolve(process.env.STORAGE_DIR, "tmp")
      : path.resolve(__dirname, `../../../storage/tmp`);
    if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath, { recursive: true });
    return path.resolve(tmpPath, filename);
  }

  async #writeToTempfile(filePath, data) {
    try {
      await fs.promises.appendFile(filePath, data, { encoding: "utf8" });
    } catch (e) {
      console.error(`Error writing to tempfile: ${e}`);
    }
  }

  async #fetchWithHost() {
    try {
      // Convert ESM to CommonJS via import so we can load this library.
      const pipeline = (...args) =>
        import("@xenova/transformers").then(({ pipeline, env }) => {
          if (!this.modelDownloaded) {
            // if model is not downloaded, we will log where we are fetching from.
            this.log(`Downloading ${this.model} from ${env.remoteHost}`);
          }
          return pipeline(...args);
        });
      return {
        pipeline: await pipeline("feature-extraction", this.model, {
          cache_dir: this.cacheDir,
          ...(!this.modelDownloaded
            ? {
                // Show download progress if we need to download any files
                progress_callback: (data) => {
                  if (!data.hasOwnProperty("progress")) return;
                  console.log(
                    `\x1b[36m[NativeEmbedder - Downloading model]\x1b[0m ${
                      data.file
                    } ${~~data?.progress}%`
                  );
                },
              }
            : {}),
        }),
        retry: false,
        error: null,
      };
    } catch (error) {
      return {
        pipeline: null,
        retry: false,
        error,
      };
    }
  }

  // Models are downloaded directly from HuggingFace on first run.
  // If the download fails, ensure the host can reach huggingface.co and retry.
  async embedderClient() {
    if (NativeEmbedder.#pipelines.has(this.model))
      return NativeEmbedder.#pipelines.get(this.model);
    if (NativeEmbedder.#pipelinePromises.has(this.model))
      return await NativeEmbedder.#pipelinePromises.get(this.model);

    const loadPromise = (async () => {
      if (!this.modelDownloaded)
        this.log(
          "The native embedding model has never been run and will be downloaded right now. Subsequent runs will be faster. (~23MB)"
        );

      let fetchResponse = await this.#fetchWithHost();
      if (fetchResponse.pipeline !== null) {
        this.modelDownloaded = true;
        NativeEmbedder.#pipelines.set(this.model, fetchResponse.pipeline);
        return fetchResponse.pipeline;
      }

      throw new Error(
        `Failed to download embedding model ${this.model} from HuggingFace. Check network connectivity and retry. Original error: ${fetchResponse.error?.message || fetchResponse.error}`
      );
      if (fetchResponse.pipeline !== null) {
        this.modelDownloaded = true;
        NativeEmbedder.#pipelines.set(this.model, fetchResponse.pipeline);
        return fetchResponse.pipeline;
      }

      throw fetchResponse.error;
    })();

    NativeEmbedder.#pipelinePromises.set(this.model, loadPromise);
    try {
      return await loadPromise;
    } finally {
      NativeEmbedder.#pipelinePromises.delete(this.model);
    }
  }

  /**
   * Apply the query prefix to the text input if it is required by the model.
   * eg: nomic-embed-text-v1 requires a query prefix for embedding/searching.
   * @param {string|string[]} textInput - The text to embed.
   * @returns {string|string[]} The text with the prefix applied.
   */
  #applyQueryPrefix(textInput) {
    if (!this.queryPrefix) return textInput;
    if (Array.isArray(textInput))
      return textInput.map((text) => `${this.queryPrefix}${text}`);
    return `${this.queryPrefix}${textInput}`;
  }

  /**
   * Embed a single text input.
   * @param {string|string[]} textInput - The text to embed.
   * @returns {Promise<Array<number>>} The embedded text.
   */
  async embedTextInput(textInput) {
    textInput = this.#applyQueryPrefix(textInput);
    const result = await this.embedChunks(
      Array.isArray(textInput) ? textInput : [textInput]
    );
    return result?.[0] || [];
  }

  // If you are thinking you want to edit this function - you probably don't.
  // This process was benchmarked heavily on a t3.small (2GB RAM 1vCPU)
  // and without careful memory management for the V8 garbage collector
  // this function will likely result in an OOM on any resource-constrained deployment.
  // To help manage very large documents we run a concurrent write-log each iteration
  // to keep the embedding result out of memory. The `maxConcurrentChunk` is set to 25,
  // as 50 seems to overflow no matter what. Given the above, memory use hovers around ~30%
  // during a very large document (>100K words) but can spike up to 70% before gc.
  // This seems repeatable for all document sizes.
  // While this does take a while, it is zero set up and is 100% free and on-instance.
  // It still may crash depending on other elements at play - so no promises it works under all conditions.
  async embedChunks(textChunks = []) {
    const tmpFilePath = this.#tempfilePath();
    const chunks = toChunks(textChunks, this.maxConcurrentChunks);
    const chunkLen = chunks.length;
    const totalChunks = textChunks.length;

    const pipeline = await this.embedderClient();
    for (let [idx, chunk] of chunks.entries()) {
      if (idx === 0) await this.#writeToTempfile(tmpFilePath, "[");
      let data;
      let output = await pipeline(chunk, {
        pooling: "mean",
        normalize: true,
      });

      if (output.length === 0) {
        output = null;
        data = null;
        continue;
      }

      data = JSON.stringify(output.tolist());
      await this.#writeToTempfile(tmpFilePath, data);
      this.log(`Embedded Chunk Group ${idx + 1} of ${chunkLen}`);
      if (chunkLen - 1 !== idx) await this.#writeToTempfile(tmpFilePath, ",");
      if (chunkLen - 1 === idx) await this.#writeToTempfile(tmpFilePath, "]");

      reportEmbeddingProgress(
        Math.min((idx + 1) * this.maxConcurrentChunks, totalChunks),
        totalChunks
      );
      output = null;
      data = null;
    }

    const embeddingResults = JSON.parse(
      fs.readFileSync(tmpFilePath, { encoding: "utf-8" })
    );
    fs.rmSync(tmpFilePath, { force: true });
    return embeddingResults.length > 0 ? embeddingResults.flat() : null;
  }
}

module.exports = {
  NativeEmbedder,
};
