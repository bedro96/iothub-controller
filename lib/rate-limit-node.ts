import { cleanupRateLimitStore } from './rate-limit'

// Start cleanup interval when running in Node (server) environment.
// This file should only be imported from Node-only entrypoints (e.g. server.ts).
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- only run in Node
  if (typeof globalThis.process !== 'undefined' && (globalThis as any).process.versions?.node) {
    setInterval(cleanupRateLimitStore, 5 * 60 * 1000)
  }
} catch (err) {
  // If anything goes wrong, fail silently — this is only a best-effort cleanup.
}

export {}
