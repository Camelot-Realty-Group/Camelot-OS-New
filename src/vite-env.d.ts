/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_AI_MODEL: string;
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  readonly VITE_DISABLE_SERVER_INTEGRATIONS: string;
  readonly VITE_ENABLE_SERVER_INTEGRATIONS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
