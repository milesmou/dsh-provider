import { z } from 'zod';
export const ModelDirectory = z.object({
    models: z.array(z.object({ id: z.string(), name: z.string(), contextWindow: z.number().positive().optional() })),
    issue: z.string().optional(),
});
export function modelDirectory(models, issue) {
    return { models: models.map(model => ({ id: model.id, name: model.name || model.id,
            ...(model.contextWindow ? { contextWindow: model.contextWindow } : {}),
        })), ...(issue ? { issue } : {}) };
}
/** Visibility changes discovery only; resolution keeps supporting already selected models. */
export function visibleModels(models, hidden = []) {
    const ids = new Set(hidden);
    return models.filter(model => !ids.has(model.id));
}
//# sourceMappingURL=model-management.js.map