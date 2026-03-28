/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Hier definieren wir unsere exakten Umgebungsvariablen für perfekte Typsicherheit
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Weitere Variablen können hier später ergänzt werden
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}