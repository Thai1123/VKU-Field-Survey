/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface WorkerGlobalScope {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
}
