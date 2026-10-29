import { z } from 'zod'

export const ModelDirectory = z.object({
  models: z.array(z.object({ id: z.string(), name: z.string(), contextWindow: z.number().positive().optional() })),
  issue: z.string().optional(),
})
export type ModelDirectoryReply = z.infer<typeof ModelDirectory>

export function modelDirectory(models: readonly { id: string; name?: string; contextWindow?: number }[], issue?: string): ModelDirectoryReply {
  return { models: models.map(model => ({ id: model.id, name: model.name || model.id,
    ...(model.contextWindow ? { contextWindow: model.contextWindow } : {}),
  })), ...(issue ? { issue } : {}) }
}

/** Visibility changes discovery only; resolution keeps supporting already selected models. */
export function visibleModels<T extends { id: string }>(models: readonly T[], hidden: readonly string[] = []): T[] {
  const ids = new Set(hidden)
  return models.filter(model => !ids.has(model.id))
}
