export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/mdc',
    '@vueuse/nuxt',
  ],
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  mdc: {
    highlight: {
      shikiEngine: 'javascript',
    },
  },
  runtimeConfig: {
    openAiApiKey: '',
    aiGatewayToken: '',
    aiGatewayURL: '',
    mcpEndpoint: '',
  },
  compatibilityDate: '2025-07-15',
  eslint: {
    config: {
      stylistic: true,
    },
  },
})
