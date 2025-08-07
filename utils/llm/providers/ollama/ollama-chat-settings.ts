export type OllamaChatModelId =
  | 'athene-v2'
  | 'athene-v2:72b'
  | 'aya-expanse'
  | 'aya-expanse:8b'
  | 'aya-expanse:32b'
  | 'codegemma'
  | 'codegemma:2b'
  | 'codegemma:7b'
  | 'codellama'
  | 'codellama:7b'
  | 'codellama:13b'
  | 'codellama:34b'
  | 'codellama:70b'
  | 'codellama:code'
  | 'codellama:python'
  | 'command-r'
  | 'command-r:35b'
  | 'command-r-plus'
  | 'command-r-plus:104b'
  | 'command-r7b'
  | 'command-r7b:7b'
  | 'deepseek-coder-v2'
  | 'deepseek-coder-v2:16b'
  | 'deepseek-coder-v2:236b'
  | 'deepseek-v3'
  | 'deepseek-v3:671b'
  | 'dolphin3'
  | 'dolphin3:8b'
  | 'exaone3.5'
  | 'exaone3.5:2.4b'
  | 'exaone3.5:7.8b'
  | 'exaone3.5:32b'
  | 'falcon2'
  | 'falcon2:11b'
  | 'falcon3'
  | 'falcon3:1b'
  | 'falcon3:3b'
  | 'falcon3:7b'
  | 'falcon3:10b'
  | 'firefunction-v2'
  | 'firefunction-v2:70b'
  | 'gemma'
  | 'gemma:2b'
  | 'gemma:7b'
  | 'gemma2'
  | 'gemma2:2b'
  | 'gemma2:9b'
  | 'gemma2:27b'
  | 'granite3-dense'
  | 'granite3-dense:2b'
  | 'granite3-dense:8b'
  | 'granite3-guardian'
  | 'granite3-guardian:2b'
  | 'granite3-guardian:8b'
  | 'granite3-moe'
  | 'granite3-moe:1b'
  | 'granite3-moe:3b'
  | 'granite3.1-dense'
  | 'granite3.1-dense:2b'
  | 'granite3.1-dense:8b'
  | 'granite3.1-moe'
  | 'granite3.1-moe:1b'
  | 'granite3.1-moe:3b'
  | 'llama2'
  | 'llama2:7b'
  | 'llama2:13b'
  | 'llama2:70b'
  | 'llama3'
  | 'llama3:8b'
  | 'llama3:70b'
  | 'llama3-chatqa'
  | 'llama3-chatqa:8b'
  | 'llama3-chatqa:70b'
  | 'llama3-gradient'
  | 'llama3-gradient:8b'
  | 'llama3-gradient:70b'
  | 'llama3.1'
  | 'llama3.1:8b'
  | 'llama3.1:70b'
  | 'llama3.1:405b'
  | 'llama3.2'
  | 'llama3.2:1b'
  | 'llama3.2:3b'
  | 'llama3.2-vision'
  | 'llama3.2-vision:11b'
  | 'llama3.2-vision:90b'
  | 'llama3.3'
  | 'llama3.3:70b'
  | 'llama-guard3'
  | 'llama-guard3:1b'
  | 'llama-guard3:8b'
  | 'llava'
  | 'llava:7b'
  | 'llava:13b'
  | 'llava:34b'
  | 'llava-llama3'
  | 'llava-llama3:8b'
  | 'llava-phi3'
  | 'llava-phi3:3.8b'
  | 'marco-o1'
  | 'marco-o1:7b'
  | 'mistral'
  | 'mistral:7b'
  | 'mistral-large'
  | 'mistral-large:123b'
  | 'mistral-nemo'
  | 'mistral-nemo:12b'
  | 'mistral-small'
  | 'mistral-small:22b'
  | 'mixtral'
  | 'mixtral:8x7b'
  | 'mixtral:8x22b'
  | 'moondream'
  | 'moondream:1.8b'
  | 'openhermes'
  | 'openhermes:v2.5'
  | 'nemotron'
  | 'nemotron:70b'
  | 'nemotron-mini'
  | 'nemotron-mini:4b'
  | 'olmo'
  | 'olmo:7b'
  | 'olmo:13b'
  | 'opencoder'
  | 'opencoder:1.5b'
  | 'opencoder:8b'
  | 'phi3'
  | 'phi3:3.8b'
  | 'phi3:14b'
  | 'phi3.5'
  | 'phi3.5:3.8b'
  | 'phi4'
  | 'phi4:14b'
  | 'qwen'
  | 'qwen:7b'
  | 'qwen:14b'
  | 'qwen:32b'
  | 'qwen:72b'
  | 'qwen:110b'
  | 'qwen2'
  | 'qwen2:0.5b'
  | 'qwen2:1.5b'
  | 'qwen2:7b'
  | 'qwen2:72b'
  | 'qwen2.5'
  | 'qwen2.5:0.5b'
  | 'qwen2.5:1.5b'
  | 'qwen2.5:3b'
  | 'qwen2.5:7b'
  | 'qwen2.5:14b'
  | 'qwen2.5:32b'
  | 'qwen2.5:72b'
  | 'qwen2.5-coder'
  | 'qwen2.5-coder:0.5b'
  | 'qwen2.5-coder:1.5b'
  | 'qwen2.5-coder:3b'
  | 'qwen2.5-coder:7b'
  | 'qwen2.5-coder:14b'
  | 'qwen2.5-coder:32b'
  | 'qwq'
  | 'qwq:32b'
  | 'sailor2'
  | 'sailor2:1b'
  | 'sailor2:8b'
  | 'sailor2:20b'
  | 'shieldgemma'
  | 'shieldgemma:2b'
  | 'shieldgemma:9b'
  | 'shieldgemma:27b'
  | 'smallthinker'
  | 'smallthinker:3b'
  | 'smollm'
  | 'smollm:135m'
  | 'smollm:360m'
  | 'smollm:1.7b'
  | 'tinyllama'
  | 'tinyllama:1.1b'
  | 'tulu3'
  | 'tulu3:8b'
  | 'tulu3:70b'
  | (string & NonNullable<unknown>)

export interface OllamaChatSettings {
  /**
   * Until Ollama officially supports tool calling in streams, the provider can try to detect function calls. Enabled by
   * default to maintain backward compatibility, disable it if you encounter any issues.
   *
   * @deprecated Use `simulateStreaming` instead.
   */
  experimentalStreamTools?: boolean

  /**
   * Enables the use of half-precision floating point values for key-value memory. This helps in optimizing memory usage. (Default: true)
   */
  f16Kv?: boolean

  /**
   * If set to true, reduces the VRAM usage by trading off speed for memory. (Default: false)
   */
  lowVram?: boolean

  /**
   * Sets which GPU is the main one.
   */
  mainGpu?: number

  /**
   * Minimum cumulative probability for tokens to be considered. (Default: 0.0)
   */
  minP?: number

  /**
   * Enable Mirostat sampling for controlling perplexity. (default: 0, 0 = disabled, 1 = Mirostat, 2 = Mirostat 2.0)
   */
  mirostat?: 0 | 1 | 2

  /**
   * Influences how quickly the algorithm responds to feedback from the generated text. A lower learning rate will
   * result in slower adjustments, while a higher learning rate will make the algorithm more responsive. (Default: 0.1)
   */
  mirostatEta?: number

  /**
   * Controls the balance between coherence and diversity of the output. A lower value will result in more focused and
   * coherent text. (Default: 5.0)
   */
  mirostatTau?: number

  /**
   * Controls whether to use Non-Uniform Memory Access (NUMA) for more efficient memory management. (Default: false)
   */
  numa?: boolean

  /**
   * Sets the number of batches to be processed. (Default: 512)
   */
  numBatch?: number

  /**
   * Sets the size of the context window used to generate the next token. (Default: 2048)
   */
  numCtx?: number

  /**
   * Controls the number of GPUs to use for the operation. (Default: -1, indicates that NumGPU should be set dynamically)
   */
  numGpu?: number

  /**
   * Keeps a number of tokens from the context. Controls how many of the previous tokens are retained. (Default: 4)
   */
  numKeep?: number

  /**
   * Controls the number of tokens to predict in a single generation. (Default: -1)
   */
  numPredict?: number

  /**
   * Sets the number of CPU threads to use. (Default: 0, indicates let the runtime decide)
   */
  numThread?: number

  /**
   * Penalizes the model for generating newline characters. If set to true, it discourages the model from generating too many newlines. (Default: true)
   */
  penalizeNewline?: boolean

  /**
   * Sets how far back for the model to look back to prevent repetition. (Default: 64, 0 = disabled, -1 = num_ctx)
   */
  repeatLastN?: number

  /**
   * Sets how strongly to penalize repetitions. A higher value (e.g., 1.5) will penalize repetitions more strongly
   * , while a lower value (e.g., 0.9) will be more lenient. (Default: 1.1)
   */
  repeatPenalty?: number

  /**
   Simulates streaming by using a normal generate call and returning it as a stream.
   Enable this if the model that you are using does not support streaming.

   Defaults to `false`.
   */
  simulateStreaming?: boolean

  /**
   * Whether to use structured outputs. Defaults to false.
   *
   * When enabled, tool calls and object generation will be strict and follow the provided schema.
   */
  structuredOutputs?: boolean

  /**
   * Tail free sampling is used to reduce the impact of less probable tokens from the output. A higher value (e.g., 2.0)
   * will reduce the impact more, while a value of 1.0 disables this setting. (default: 1)
   */
  tfsZ?: number

  /**
   * Controls the "typical" sampling probability. (Default: 1.0)
   */
  typicalP?: number

  /**
   * Locks the memory to prevent swapping, which can be useful for performance optimization. (Default: false)
   */
  useMlock?: boolean

  /**
   * Enables memory mapping to reduce RAM usage. (Default: false)
   */
  useMmap?: boolean

  /**
   * If true, the model will only load the vocabulary without performing further computation. (Default: false)
   */
  vocabOnly?: boolean

  /**
   * If true, the model will use thinking. (Default: true)
   * @link https://ollama.com/blog/thinking
   */
  think?: boolean
}
