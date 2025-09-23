<script lang="ts" setup>
import type { ChatStatus, UIMessage } from 'ai'
import { getTextFromMessage } from '@nuxt/ui/utils/ai'

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  ],
  script: [
    { 'defer': true, 'data-domain': 'chat.soubiran.dev', 'src': 'https://plausible.soubiran.dev/js/script.outbound-links.js' },
    { innerHTML: 'window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments) }' },
  ],
  htmlAttrs: {
    lang: 'en',
  },
})

const title = 'Estéban\'s website Assistant'
const description = 'Based on the content of Estéban\'s website, get instant answers to your questions.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
})

interface ChunkDecontextualizedQuery {
  message_type: 'decontextualized_query'
  decontextualized_query: string
}

interface ChunkApiVersion {
  message_type: 'api_version'
  api_version: string
}

interface ChunkDataRetention {
  message_type: 'data_retention'
  data_retention: string
}

interface ChunkSummary {
  message_type: 'summary'
  message: string
}

interface ChunkResultBatch {
  message_type: 'result_batch'
  results: Array<{
    name: string
    url: string
    site: string
    siteUrl: string
    score: number
    description: string
    schema_object: {
      '@context': string
      '@type': string
      '@id': string
      'name': string
      'brand': {
        '@type': string
        'name': string
      }
      'description': string
      'image': string
    }
  }>
}

type Chunk = {
  message_type: 'complete' | 'error'
} | ChunkApiVersion | ChunkDataRetention | ChunkSummary | ChunkResultBatch | ChunkDecontextualizedQuery

const runtimeConfig = useRuntimeConfig()

const eventSource = shallowRef<EventSource | null>(null)

const input = ref('')
const messages = ref<UIMessage[]>([])
const chat = ref<{
  error: Error | undefined
  status: ChatStatus
}>({
  error: undefined,
  status: 'ready',
})
function handleSubmit() {
  if (eventSource.value) {
    eventSource.value!.close()
    eventSource.value = null
  }

  chat.value.status = 'submitted'

  const params = new URLSearchParams({
    query: input.value,
    generate_mode: 'summarize',
    display_mode: 'full',
    site: 'all',
  })
  const prev = messages.value
    .filter(msg => msg.role === 'user')
    .map(msg => msg.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join(' '))
  if (prev.length > 0) {
    params.set('prev', JSON.stringify(prev))
  }
  const url = `${runtimeConfig.public.nlwebUrl}/ask?${params.toString()}`
  eventSource.value = new EventSource(url)

  messages.value.push({
    id: crypto.randomUUID(),
    role: 'user',
    parts: [
      {
        type: 'text',
        text: input.value,
      },
    ],
  })

  input.value = ''

  eventSource.value.onerror = () => {
    chat.value.error = new Error('An error occurred while connecting to the server.')
    chat.value.status = 'error'

    eventSource.value!.close()
  }

  eventSource.value.onmessage = (event: MessageEvent<string>) => {
    const chunk = JSON.parse(event.data) as Chunk

    if (chunk.message_type === 'api_version' || chunk.message_type === 'data_retention' || chunk.message_type === 'decontextualized_query') {
      return
    }

    const lastMessage = messages.value[messages.value.length - 1]
    if (lastMessage && lastMessage.role === 'user') {
      messages.value.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        parts: [],
      })
    }

    chat.value.status = 'streaming'

    if (chunk.message_type === 'summary') {
      messages.value[messages.value.length - 1]!.parts.push({
        type: 'text',
        text: chunk.message,
      })
    }
    else if (chunk.message_type === 'result_batch') {
      for (const result of chunk.results) {
        messages.value[messages.value.length - 1]!.parts.push({
          sourceId: result.url,
          type: 'source-url',
          url: result.url,
          title: result.schema_object.name,
        })
      }
    }
    else if (chunk.message_type === 'complete') {
      chat.value.status = 'ready'
      eventSource.value!.close()
      eventSource.value = null
    }
  }
}
function stopChat() {
  eventSource.value!.close()
  chat.value.status = 'ready'
}
</script>

<template>
  <div>
    <UApp>
      <NuxtRouteAnnouncer />

      <UHeader
        title="Estéban's website Assistant"
        :ui="{ root: 'border-0', toggle: 'hidden' }"
      >
        <template #right>
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-simple-icons:github"
            square
            href="https://github.com/barbapapazes/chat.soubiran.dev"
            target="_blank"
          />
        </template>
      </UHeader>

      <UMain class="flex">
        <UContainer class="pt-4 flex-1 flex flex-col gap-4 sm:gap-6">
          <UChatMessages
            :status="chat.status"
          >
            <!-- Workaround because of missing bottom slot. -->
            <div
              v-for="(message, index) in messages"
              :key="index"
              :class="{ 'pb-8': message.role === 'assistant' }"
            >
              <UChatMessage
                :side="message.role === 'assistant' ? 'left' : 'right'"
                :variant="message.role === 'assistant' ? 'outline' : 'soft'"
                :avatar="message.role === 'assistant' ? { src: 'https://github.com/barbapapazes-sponsors.png' } : undefined"
                :ui="{ container: message.role === 'assistant' ? 'pb-1' : undefined }"
                v-bind="message"
              >
                <template #content>
                  <MDCCached
                    :value="getTextFromMessage(message)"
                    :cache-key="message.id"
                    unwrap="p"
                    :parser-options="{ highlight: false }"
                  />
                </template>
              </UChatMessage>

              <div
                v-if="message.role === 'assistant' && message.parts.some(part => part.type === 'source-url')"
                class="flex justify-end"
              >
                <UDropdownMenu
                  size="xs"
                  :content="{ align: 'end', side: 'bottom' }"
                  :items="message.parts.filter(part => part.type === 'source-url').map(part => ({ label: part.title?.split(' - ')[0], href: part.url, target: '_blank' }))"
                >
                  <UButton
                    trailing-icon="i-lucide-chevron-down"
                    label="Sources"
                    color="primary"
                    variant="link"
                    size="xs"
                  />
                </UDropdownMenu>
              </div>
            </div>
          </UChatMessages>

          <UChatPrompt
            v-model="input"
            :error="chat.error"
            variant="subtle"
            placeholder="Ask to Estéban's website Assistant..."
            class="sticky z-10 transition-all duration-200"
            :class="{ 'bottom-1/2': messages.length === 0, 'bottom-0 rounded-b-none': messages.length > 0 }"
            @submit="handleSubmit"
          >
            <UChatPromptSubmit
              color="neutral"
              :status="chat.status"
              @stop="stopChat"
            />

            <template #footer>
              <p class="text-dimmed text-[0.675rem] px-2.5">
                AI answers use info from <ULink href="https://soubiran.dev">Estéban's website</ULink>. Verify important details independently.
              </p>
            </template>
          </UChatPrompt>
        </UContainer>
      </UMain>
    </UApp>
  </div>
</template>
