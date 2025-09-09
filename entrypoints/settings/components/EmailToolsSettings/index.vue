<template>
  <Section
    title="Gmail Tools"
    description="Configure various writing assistance features"
  >
    <!-- Basic Settings -->
    <Block title="Basic Settings">
      <div class="space-y-5">
        <!-- Enable Gmail Tools -->
        <div class="flex items-center justify-between">
          <div class="flex items-start">
            <div
              class="w-4 h-4 mt-1 mr-3 rounded border-2 border-gray-300 flex items-center justify-center transition-colors"
              :class="enabled ? 'bg-green-500 border-green-500' : 'bg-white'"
            >
              <svg
                v-if="enabled"
                class="w-2.5 h-2.5 text-white"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <div>
              <label
                class="text-sm font-medium text-gray-900 cursor-pointer"
                @click="enabled = !enabled"
              >
                Enable Gmail Tools
              </label>
              <p class="text-sm text-gray-500 mt-0.5">
                Show AI assistance features directly inside Gmail.
              </p>
            </div>
          </div>
        </div>

        <!-- Output Language -->
        <div :class="{ 'opacity-50 pointer-events-none': !enabled }">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Output Language
          </label>
          <div class="relative">
            <select
              v-model="outputLanguage"
              :disabled="!enabled"
              class="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed appearance-none pr-8"
            >
              <option value="auto">
                Auto
              </option>
              <option value="en">
                English
              </option>
              <option value="es">
                Spanish
              </option>
              <option value="fr">
                French
              </option>
              <option value="de">
                German
              </option>
              <option value="it">
                Italian
              </option>
              <option value="pt">
                Portuguese
              </option>
              <option value="ru">
                Russian
              </option>
              <option value="ja">
                Japanese
              </option>
              <option value="ko">
                Korean
              </option>
              <option value="zh">
                Chinese
              </option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg
                class="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Choose the default language for AI-generated emails.
          </p>
        </div>

        <!-- Output Style -->
        <div :class="{ 'opacity-50 pointer-events-none': !enabled }">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Output Style
          </label>
          <div class="relative">
            <select
              v-model="outputStyle"
              :disabled="!enabled"
              class="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed appearance-none pr-8"
            >
              <option value="default">
                Default
              </option>
              <option value="formal">
                Formal
              </option>
              <option value="friendly">
                Friendly
              </option>
              <option value="urgent">
                Urgent
              </option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <svg
                class="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Choose the default tone for your emails
          </p>
        </div>
      </div>
    </Block>

    <!-- System Prompt -->
    <Block title="System Prompt">
      <div
        class="space-y-6"
        :class="{ 'opacity-50 pointer-events-none': !enabled }"
      >
        <!-- Summarize -->
        <div>
          <div class="flex items-center mb-2">
            <svg
              class="w-4 h-4 text-gray-600 mr-2"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9zM3.5 3a.5.5 0 0 0-.5.5V12a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V3.5a.5.5 0 0 0-.5-.5h-9z" />
              <path d="M5 5.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zM5 9.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5z" />
            </svg>
            <h4 class="text-sm font-medium text-gray-900">
              Summarize
            </h4>
          </div>
          <p class="text-sm text-gray-500 mb-3">
            Quickly extract key points from long emails or entire threads.
          </p>
          <div class="relative">
            <textarea
              v-model="summaryPrompt"
              :disabled="!enabled"
              rows="4"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed resize-none"
              placeholder="You are a highly skilled translator, you will be provided an html string array in JSON format, and your task is to translate each string into {{LANGUAGE}}, preserving any html tag..."
            />
            <button
              v-if="summaryPrompt !== DEFAULT_GMAIL_SUMMARY_SYSTEM_PROMPT"
              :disabled="!enabled"
              class="absolute top-2 right-2 p-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset to default"
              @click="resetSummaryPrompt"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Reply -->
        <div>
          <div class="flex items-center mb-2">
            <svg
              class="w-4 h-4 text-gray-600 mr-2"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M8.5 1.5A6.5 6.5 0 0 1 15 8a.5.5 0 0 1-1 0 5.5 5.5 0 1 0-5.5 5.5.5.5 0 0 1 0 1A6.5 6.5 0 0 1 8.5 1.5z" />
              <path d="M9.5 3a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.146.354l-3 3a.5.5 0 0 1-.708-.708L8.793 7.5H4a.5.5 0 0 1 0-1h4.793l-2.647-2.646a.5.5 0 0 1 .708-.708l3 3A.5.5 0 0 1 10 6.5v-3a.5.5 0 0 1 .5-.5z" />
            </svg>
            <h4 class="text-sm font-medium text-gray-900">
              Reply
            </h4>
          </div>
          <p class="text-sm text-gray-500 mb-3">
            Instantly draft a natural reply based on the email content and your notes.
          </p>
          <div class="relative">
            <textarea
              v-model="replyPrompt"
              :disabled="!enabled"
              rows="4"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed resize-none"
              placeholder="You are a highly skilled translator, you will be provided an html string array in JSON format, and your task is to translate each string into {{LANGUAGE}}, preserving any html tag..."
            />
            <button
              v-if="replyPrompt !== DEFAULT_GMAIL_REPLY_SYSTEM_PROMPT"
              :disabled="!enabled"
              class="absolute top-2 right-2 p-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset to default"
              @click="resetReplyPrompt"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Compose -->
        <div>
          <div class="flex items-center mb-2">
            <svg
              class="w-4 h-4 text-gray-600 mr-2"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z" />
              <path
                fill-rule="evenodd"
                d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z"
              />
            </svg>
            <h4 class="text-sm font-medium text-gray-900">
              Compose
            </h4>
          </div>
          <p class="text-sm text-gray-500 mb-3">
            Start from scratch or polish your draft.
          </p>
          <div class="relative">
            <textarea
              v-model="composePrompt"
              :disabled="!enabled"
              rows="4"
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed resize-none"
              placeholder="You are a highly skilled translator, you will be provided an html string array in JSON format, and your task is to translate each string into {{LANGUAGE}}, preserving any html tag..."
            />
            <button
              v-if="composePrompt !== DEFAULT_GMAIL_COMPOSE_SYSTEM_PROMPT"
              :disabled="!enabled"
              class="absolute top-2 right-2 p-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset to default"
              @click="resetComposePrompt"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Block>
  </Section>
</template>

<script setup lang="ts">
import { getUserConfig } from '@/utils/user-config'
import { DEFAULT_GMAIL_COMPOSE_SYSTEM_PROMPT, DEFAULT_GMAIL_REPLY_SYSTEM_PROMPT, DEFAULT_GMAIL_SUMMARY_SYSTEM_PROMPT } from '@/utils/user-config/defaults'

import Block from '../Block.vue'
import Section from '../Section.vue'

const userConfig = await getUserConfig()

// Reactive refs for all settings
const enabled = userConfig.emailTools.enable.toRef()
const outputLanguage = userConfig.emailTools.outputLanguage.toRef()
const outputStyle = userConfig.emailTools.outputStyle.toRef()
const summaryPrompt = userConfig.emailTools.summary.systemPrompt.toRef()
const replyPrompt = userConfig.emailTools.reply.systemPrompt.toRef()
const composePrompt = userConfig.emailTools.compose.systemPrompt.toRef()

// Reset functions
function resetSummaryPrompt() {
  summaryPrompt.value = DEFAULT_GMAIL_SUMMARY_SYSTEM_PROMPT
}

function resetReplyPrompt() {
  replyPrompt.value = DEFAULT_GMAIL_REPLY_SYSTEM_PROMPT
}

function resetComposePrompt() {
  composePrompt.value = DEFAULT_GMAIL_COMPOSE_SYSTEM_PROMPT
}
</script>

<style scoped>
/* Custom styles for Gmail Tools settings */
select {
  background-image: none;
}

.space-y-5 > * + * {
  margin-top: 1.25rem;
}

.space-y-6 > * + * {
  margin-top: 1.5rem;
}

/* Custom checkbox styling */
.custom-checkbox {
  appearance: none;
  -webkit-appearance: none;
}

/* Smooth transitions */
.transition-colors {
  transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out;
}
</style>
