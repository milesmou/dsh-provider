import type { Context } from '@deepseek-ai/cordis'

/** One session's model-selection store, shared by the model picker and header badges. */
export interface SelectionSource {
  getSnapshot(): { current?: { provider?: string; model?: string } | null } | undefined
  subscribe(listener: () => void): () => void
}

export function sessionSelection(ctx: Context, sessionId: string): SelectionSource | undefined {
  const directories = ctx.get('modelDirectories') as {
    directoryFor(sessionId: string): { store?: SelectionSource } | undefined
  } | undefined
  try { return directories?.directoryFor(sessionId)?.store } catch { return undefined }
}
