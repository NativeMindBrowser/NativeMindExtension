# NativeMind Browser LLM API Documentation (Beta)

## Overview

> Please note that this API is currently in beta and is subject to change.

The `navigator.llm.responses` API is a powerful browser-native interface that brings Large Language Model capabilities directly to web applications. Built into the NativeMind extension, this API provides seamless access to local AI models without requiring external API keys or cloud dependencies.

### How It Works

The API acts as a bridge between your web application and locally running AI models managed by NativeMind. When you make a request:

1. **Model Verification**: The API checks if the specified model is available and ready
2. **Request Processing**: Your prompt, images, and parameters are processed locally
3. **Response Generation**: The AI model generates responses based on your input
4. **Structured Output**: If a schema is provided, responses are formatted as JSON objects
5. **Streaming Delivery**: Results can be delivered incrementally for real-time updates

### Browser Integration

The API extends the native `navigator` object, making it available globally in any web page where the NativeMind extension is active. No additional libraries or authentication required - just start using `navigator.llm.responses.create()` in your JavaScript code.

## Usage Examples

### Feature Detection

Before using the API, it's recommended to check if the NativeMind extension is available and the API is accessible:

```javascript
// Check if the NativeMind LLM API is available
if (navigator.llm?.responses?.create) {
  // NativeMind extension is available, proceed with API usage
} else {
  // Show message to user about installing the extension
  // or provide alternative functionality
}
```

### Basic Non-Streaming Request

```javascript
const response = await navigator.llm.responses.create({
  prompt: "Explain quantum computing in simple terms",
});

console.log(response.text);
```

### Streaming Request

```javascript
const stream = await navigator.llm.responses.create({
  prompt: "Write a short story about a robot",
  stream: true,
});

for await (const chunk of stream) {
  if (chunk.type === "text-delta") {
    console.log(chunk.textDelta);
  }
}
```

### Using Messages Format

```javascript
const response = await navigator.llm.responses.create({
  messages: [
    { role: "system", content: "You are a helpful coding assistant." },
    { role: "user", content: "How do I create a REST API in Node.js?" },
  ],
  temperature: 0.7,
});

console.log(response.text);
```

### Using Images in Messages

```javascript
const response = await navigator.llm.responses.create({
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "What do you see in this image?",
        },
        {
          type: "image",
          image: base64ImageData, // /9j/4AAQSkZJRgABAQAAAQ...
          mimeType: "image/jpeg",
        },
      ],
    },
  ],
});

console.log(response.text);
```

### Mixed Content with Images

```javascript
const response = await navigator.llm.responses.create({
  messages: [
    { role: "system", content: "You are a helpful image analysis assistant." },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Please analyze this screenshot and tell me what programming language is being used:",
        },
        {
          type: "image",
          image: base64ImageData, // /9j/4AAQSkZJRgABAQAAAQ...
          mimeType: "image/png",
        },
      ],
    },
  ],
});
```

### Advanced Configuration

```javascript
const response = await navigator.llm.responses.create({
  prompt: "Analyze this data and provide insights",
  system: "You are a data analyst expert",
  model: "llama-3.1:8b",
  temperature: 0.3,
  maxTokens: 500,
  topP: 0.9,
});
```

### Function Calling with Tools

The API supports function calling through tools, allowing the AI model to call external functions and APIs. This enables the model to perform actions beyond text generation, such as retrieving data, performing calculations, or interacting with external services.

#### Basic Tool Definition

```javascript
const response = await navigator.llm.responses.create({
  prompt: "What's the weather like in New York?",
  tools: [
    {
      name: "getWeather",
      description: "Get current weather information for a specific location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state, e.g. San Francisco, CA",
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit",
          },
        },
        required: ["location"],
      },
    },
  ],
});

// Check if the model wants to call a function
if (response.toolCalls && response.toolCalls.length > 0) {
  for (const toolCall of response.toolCalls) {
    if (toolCall.toolName === "getWeather") {
      const args = toolCall.args;
      console.log("Model wants to get weather for:", args.location);

      // Call your actual weather API here
      const weatherData = await getWeatherAPI(args.location, args.unit);

      // Continue the conversation with the function result
      const followUp = await navigator.llm.responses.create({
        messages: [
          { role: "user", content: "What's the weather like in New York?" },
          { role: "assistant", content: response.text },
          {
            role: "assistant",
            content: JSON.stringify(weatherData),
            toolCallId: toolCall.toolCallId,
          },
        ],
      });

      console.log(followUp.text);
    }
  }
}
```

#### Streaming with Tools

```javascript
const stream = await navigator.llm.responses.create({
  prompt: "Generate an image of a sunset",
  stream: true,
  tools: [
    {
      name: "generateImage",
      description: "Generate an image based on a text prompt",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Description of the image to generate",
          },
          style: {
            type: "string",
            enum: ["realistic", "artistic", "cartoon"],
            description: "Style of the image",
          },
        },
        required: ["prompt"],
      },
    },
  ],
});

for await (const chunk of stream) {
  if (chunk.type === "text-delta") {
    console.log("Text:", chunk.textDelta);
  } else if (chunk.type === "tool-call") {
    console.log("Tool call:", chunk.toolName, chunk.args);

    // Handle the tool call
    if (chunk.toolName === "generateImage") {
      const args = chunk.args;
      console.log("Generated image with prompt:", args.prompt);
    }
  }
}
```

### Structured Output with Schema

The API supports structured output generation using JSON Schema. When a `schema` parameter is provided, the response will be a structured object instead of plain text.

#### Basic Structured Output

```javascript
const response = await navigator.llm.responses.create({
  prompt: "Generate a random person's information",
  schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Full name of the person",
      },
      age: {
        type: "number",
        description: "Age in years",
        minimum: 1,
        maximum: 100,
      },
      email: {
        type: "string",
        format: "email",
        description: "Email address",
      },
    },
    required: ["name", "age", "email"],
  },
});

console.log(response.object); // { name: "John Doe", age: 30, email: "john@example.com" }
```

#### Complex Schema with Nested Objects

```javascript
const response = await navigator.llm.responses.create({
  prompt: "Analyze this product review and extract key information",
  system: "You are a product review analyzer",
  schema: {
    type: "object",
    properties: {
      sentiment: {
        type: "string",
        enum: ["positive", "negative", "neutral"],
        description: "Overall sentiment of the review",
      },
      rating: {
        type: "number",
        minimum: 1,
        maximum: 5,
        description: "Predicted rating (1-5 stars)",
      },
      keyPoints: {
        type: "array",
        items: {
          type: "object",
          properties: {
            aspect: {
              type: "string",
              description: "Product aspect being discussed",
            },
            opinion: {
              type: "string",
              description: "Opinion about this aspect",
            },
            sentiment: {
              type: "string",
              enum: ["positive", "negative", "neutral"],
            },
          },
          required: ["aspect", "opinion", "sentiment"],
        },
        description: "Key points mentioned in the review",
      },
      summary: {
        type: "string",
        description: "Brief summary of the review",
      },
    },
    required: ["sentiment", "rating", "keyPoints", "summary"],
  },
});

console.log(response.object);
// {
//   sentiment: "positive",
//   rating: 4,
//   keyPoints: [
//     { aspect: "battery life", opinion: "lasts all day", sentiment: "positive" },
//     { aspect: "screen quality", opinion: "very clear", sentiment: "positive" }
//   ],
//   summary: "Great product with excellent battery and display"
// }
```

#### Streaming Structured Output

```javascript
const stream = await navigator.llm.responses.create({
  prompt: "Generate a story with characters and plot",
  stream: true,
  schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Story title",
      },
      characters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: "string" },
            description: { type: "string" },
          },
          required: ["name", "role"],
        },
      },
      plot: {
        type: "string",
        description: "Main plot of the story",
      },
    },
    required: ["title", "characters", "plot"],
  },
});

for await (const chunk of stream) {
  if (chunk.type === "object") {
    console.log("Partial object:", chunk.object);
  }
}
```

#### Schema Response Types

When using schema, the response object structure changes:

```typescript
interface StructuredResponseObject {
  object: any; // The generated object matching your schema
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface StructuredStreamChunk {
  type: "object" | "finish" | "error";
  object?: any; // Partial or complete object
  finishReason?: string;
  error?: Error;
}
```

## API Reference

### `navigator.llm.responses`

The main responses object that provides methods for creating text completions.

#### Methods

##### `create(params)`

Creates a text completion, either streaming or non-streaming based on the `stream` parameter.

**Overloads:**

- `create(params: ResponseCreateParamsNonStreaming): Promise<NonStreamResponseObject>`
- `create(params: ResponseCreateParamsStreaming): Promise<StreamResponseObject>`

**Parameters:**

| Parameter     | Type             | Required | Description                                                                                                                                               |
| ------------- | ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`      | `string`         | Yes      | The text prompt to generate a response for                                                                                                                |
| `messages`    | `Array<Message>` | No       | Array of conversation messages (alternative to prompt)                                                                                                    |
| `system`      | `string`         | No       | System message to set the behavior of the assistant                                                                                                       |
| `stream`      | `boolean`        | No       | Whether to stream the response. Default: `false`                                                                                                          |
| `model`       | `string`         | No       | Model identifier to use for generation, which should be downloaded and available in the NativeMind settings. default to value used in NativeMind settings |
| `maxTokens`   | `number`         | No       | Maximum number of tokens to generate                                                                                                                      |
| `temperature` | `number`         | No       | Controls randomness (0.0 to 1.0)                                                                                                                          |
| `topK`        | `number`         | No       | Limits token selection to top K tokens                                                                                                                    |
| `topP`        | `number`         | No       | Nucleus sampling parameter (0.0 to 1.0)                                                                                                                   |
| `schema`      | `JSONSchema`     | No       | JSON Schema for structured output generation                                                                                                              |
| `tools`       | `Array<Tool>`    | No       | Array of tools/functions the model can call                                                                                                               |

**Message Format:**

```typescript
interface Message {
  role: "user" | "assistant" | "system";
  content: string | Array<ContentPart>;
}

type ContentPart = TextPart | ImagePart;

/**
 * Text content part of a prompt. It contains a string of text.
 */
interface TextPart {
  type: "text";
  text: string;
}

/**
 * Image content part of a prompt. It contains an image.
 */
interface ImagePart {
  type: "image";
  image: DataContent;
  mimeType?: string;
}

type DataContent = string | Uint8Array | ArrayBuffer;
```

**Image Support:**
Messages support images through the `ImagePart` content part. Images can be provided as:

- Base64-encoded strings
- Uint8Array, ArrayBuffer, or Buffer data

Supported image formats:

- JPEG (`image/jpeg`)
- PNG (`image/png`)

**Tool Format:**

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
}

type ToolChoice =
  | "auto"
  | "none"
  | "required"
  | {
      type: "tool";
      toolName: string;
    };

interface ToolCall {
  toolCallType: "function";
  toolCallId: string;
  toolName: string;
  args: string; // JSON string of the arguments
}

interface ToolMessage extends Message {
  role: "tool";
  content: string;
  toolCallId: string;
}
```

**Tool Support:**

- **Function Calling**: Define custom functions that the model can call
- **Streaming Tools**: Receive tool calls in real-time during streaming

### Response Types

#### Non-Streaming Response

When `stream` is `false` or not specified, the method returns a complete response object:

```typescript
interface NonStreamResponseObject {
  text: string;
  finishReason: string;
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  // Additional response metadata
}
```

#### Streaming Response

When `stream` is `true`, the method returns an async iterable that yields response chunks:

```typescript
interface StreamResponseObject extends AsyncIterable<StreamPart> {
  // Async iterator that yields streaming chunks
}

type StreamPart =
  | TextStreamPart
  | ToolCallStreamPart
  | ToolCallDeltaStreamPart
  | FinishStreamPart
  | ErrorStreamPart;

interface TextStreamPart {
  type: "text-delta";
  textDelta: string;
}

interface ToolCallStreamPart {
  type: "tool-call";
  toolCallType: "function";
  toolCallId: string;
  toolName: string;
  args: string;
}

interface ToolCallDeltaStreamPart {
  type: "tool-call-delta";
  toolCallType: "function";
  toolCallId: string;
  toolName: string;
  argsTextDelta: string;
}

interface FinishStreamPart {
  type: "finish";
  finishReason: string;
}

interface ErrorStreamPart {
  type: "error";
  error: Error;
}
```

#### Structured Output Response

When a `schema` parameter is provided, the response format changes to return structured objects:

**Non-Streaming Structured Response:**

```typescript
interface StructuredResponseObject {
  object: any; // The generated object matching your schema
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

**Streaming Structured Response:**

```typescript
interface StructuredStreamResponseObject
  extends AsyncIterable<StructuredStreamPart> {
  // Async iterator that yields structured chunks
}

interface StructuredStreamPart {
  type: "object" | "finish" | "error";
  object?: any; // Partial or complete object matching your schema
  finishReason?: string;
  error?: Error;
}
```

## Error Handling

The API throws errors in the following scenarios:

- **Model Not Ready**: When the specified model is not available or the backend is not running
- **Invalid Parameters**: When required parameters are missing or invalid
- **Network Issues**: When communication with the backend fails
- **Abort Signal**: When the request is cancelled
- **Image Processing**: When images are invalid, too large, or unsupported format
- **Schema Validation**: When the generated output doesn't match the provided schema

```javascript
try {
  const response = await navigator.llm.responses.create({
    prompt: "Hello world",
    model: "non-existent-model",
  });
} catch (error) {
  if (error.message.includes("model is not ready")) {
    console.log(
      "Please ensure the AI backend is running and the model is downloaded"
    );
  } else if (error.message.includes("image")) {
    console.log("Image processing error:", error.message);
  } else if (error.message.includes("schema")) {
    console.log("Schema validation error:", error.message);
  }
}
```

## Tool Best Practices

### Tool Design Guidelines

1. **Clear Descriptions**: Provide detailed descriptions for both the tool and its parameters
2. **Specific Parameters**: Use appropriate JSON Schema constraints to guide the model
3. **Error Handling**: Always handle tool execution errors gracefully
4. **Security**: Validate and sanitize all tool inputs before execution

```javascript
const weatherTool = {
  name: "getWeather",
  description:
    "Get current weather information for a specific location. Use this when users ask about weather conditions.",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description:
          'The city and state/country, e.g. "San Francisco, CA" or "London, UK"',
      },
      unit: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        default: "celsius",
        description: "Temperature unit preference",
      },
    },
    required: ["location"],
  },
};
```

### Common Tool Patterns

**API Integration:**

```javascript
const apiTool = {
  name: "searchWeb",
  description: "Search the web for current information",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query",
      },
      maxResults: {
        type: "number",
        minimum: 1,
        maximum: 10,
        default: 5,
      },
    },
    required: ["query"],
  },
};
```

**Data Processing:**

```javascript
const dataTool = {
  name: "analyzeData",
  description: "Analyze numerical data and return statistics",
  parameters: {
    type: "object",
    properties: {
      data: {
        type: "array",
        items: { type: "number" },
        description: "Array of numerical values",
      },
      operations: {
        type: "array",
        items: {
          type: "string",
          enum: ["mean", "median", "mode", "std", "min", "max"],
        },
        description: "Statistical operations to perform",
      },
    },
    required: ["data", "operations"],
  },
};
```

## Model Management

The API automatically checks if the specified model is ready before processing requests. If a model is not available:

1. The NativeMind container will be toggled to show
2. Settings panel will be opened
3. An error toast notification will be displayed
4. The request will be rejected with an appropriate error

https://github.com/user-attachments/assets/53f80190-f9e8-4203-bac8-18bba84aa560


## Browser Compatibility

This API is available when the NativeMind extension is installed and active. It extends the native `navigator` object with LLM capabilities.

## Notes

- All requests are processed locally through the NativeMind backend
- The API supports both prompt-based and conversation-based interactions
- Streaming responses provide real-time text generation for better user experience
- Model availability is checked automatically before each request
