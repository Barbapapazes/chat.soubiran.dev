<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport, type UIToolInvocation } from 'ai'
import ProseStreamPre from '../components/prose/PreStream.vue'
import type { DefineComponent } from 'vue'

const components = {
  pre: ProseStreamPre as unknown as DefineComponent,
}

const input = ref('')

const chat = new Chat({
  transport: new DefaultChatTransport({
    api: '/api/search',
  }),
  onError(error) {
    console.error('Chat error:', error)
  },
})

const handleSubmit = (e: Event) => {
  e.preventDefault()
  chat.sendMessage({ text: input.value })
  input.value = ''
}

type State = UIToolInvocation<any>['state']

function getToolMessage(state: State, toolName: string, input: any) {
  const searchVerb = state === 'output-available' ? 'Searched' : 'Searching'
  const readVerb = state === 'output-available' ? 'Read' : 'Reading'

  return {
    list_languages: `${searchVerb} languages`,
    list_parts: `${searchVerb} parts`,
    list_pages: `${searchVerb} pages`,
    list_posts: `${searchVerb} posts`,
    list_series: `${searchVerb} series`,
    list_series_articles: `${searchVerb} series articles`,
    list_projects: `${searchVerb} projects`,
    list_talks: `${searchVerb} talks`,
    list_socials: `${searchVerb} socials`,
    get_page: `${readVerb} ${input.path || ''} page`,
  }[toolName] || `${searchVerb} ${toolName}`
}

const getCachedToolMessage = useMemoize((state: State, toolName: string, input: string) =>
  getToolMessage(state, toolName, JSON.parse(input)),
)
</script>

<template>
  <UDashboardPanel>
    <template #body>
      <UContainer>
        <UChatMessages
          :messages="chat.messages"
          :status="chat.status"
        >
          <template #content="{ message }">
            <div class="*:first:!mt-0 *:last:!mb-0">
              <template
                v-for="(part, index) in message.parts"
                :key="`${message.id}-${index}`"
              >
                <MDCCached
                  v-if="part.type === 'text'"
                  :value="part.text"
                  :cache-key="`${message.id}-${index}`"
                  :components="components"
                  unwrap="div"
                  :parser-options="{ highlight: false }"
                  class="[&_.my-5]:my-2.5 *:first:!mt-0 *:last:!mb-0 [&_.leading-7]:!leading-6"
                />

                <p
                  v-if="part.type === 'dynamic-tool'"
                  class="text-muted text-sm leading-6 my-1.5"
                >
                  {{ getCachedToolMessage(part.state, part.toolName, JSON.stringify(part.input || {})) }}
                </p>
              </template>
            </div>
          </template>
        </UChatMessages>
      </UContainer>
    </template>

    <template #footer>
      <UContainer>
        <UChatPrompt
          v-model="input"
          :error="chat.error"
          @submit="handleSubmit"
        >
          <UChatPromptSubmit
            :status="chat.status"
            @stop="chat.stop"
            @reload="chat.regenerate"
          />
        </UChatPrompt>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
