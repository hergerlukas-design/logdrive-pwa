/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  // Hier definieren wir unsere exakten Umgebungsvariablen für perfekte Typsicherheit
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  // Weitere Variablen können hier später ergänzt werden
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Werden beim Build in vite.config.ts gesetzt
declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string
