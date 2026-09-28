/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_PROVIDER?: 'openai' | 'anthropic';
  readonly VITE_AI_BASE_URL?: string;
  readonly VITE_AI_MODEL?: string;
  readonly VITE_AI_API_KEY?: string;
  readonly VITE_AI_TIMEOUT_MS?: string;
  readonly VITE_AI_JSON_MODE?: string;
  readonly VITE_AI_USE_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.pdf?url' {
  const src: string;
  export default src;
}
