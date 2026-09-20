/* eslint-env jest */

/**
 * Tests for getBaseLLMProviderModel in the single-runtime product.
 * Only the ollama provider resolves a model preference; every other
 * slug falls through to null.
 */

describe("getBaseLLMProviderModel - helpers/index.js", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.OLLAMA_MODEL_PREF;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test("returns OLLAMA_MODEL_PREF for the ollama provider when set", () => {
    process.env.OLLAMA_MODEL_PREF = "qwen3.5:4b";
    const { getBaseLLMProviderModel } = require("../../../utils/helpers/index");
    expect(getBaseLLMProviderModel({ provider: "ollama" })).toBe("qwen3.5:4b");
  });

  test("returns undefined-equivalent when OLLAMA_MODEL_PREF is not set", () => {
    const { getBaseLLMProviderModel } = require("../../../utils/helpers/index");
    expect(
      getBaseLLMProviderModel({ provider: "ollama" })
    ).toBeUndefined();
  });

  test("unknown providers resolve to null", () => {
    process.env.OLLAMA_MODEL_PREF = "qwen3.5:4b";
    const { getBaseLLMProviderModel } = require("../../../utils/helpers/index");
    expect(getBaseLLMProviderModel({ provider: "openai" })).toBeNull();
    expect(getBaseLLMProviderModel({ provider: "azure" })).toBeNull();
  });

  test("router providers resolve to null (no single model)", () => {
    const { getBaseLLMProviderModel } = require("../../../utils/helpers/index");
    expect(
      getBaseLLMProviderModel({ provider: "usingopen-router" })
    ).toBeNull();
  });
});
