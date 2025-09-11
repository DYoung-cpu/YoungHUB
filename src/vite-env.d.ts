/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_ALLOWED_EMAIL_1: string
  readonly VITE_ALLOWED_EMAIL_2: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}