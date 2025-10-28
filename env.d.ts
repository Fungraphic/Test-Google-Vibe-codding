/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_PICOVOICE_ACCESS_KEY?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
