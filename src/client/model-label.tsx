import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { ModelNameLabel as WorkBuddyModelNameLabel } from '../components/workbuddy/client/model-label.js'
import type { ModelNameLabelProps } from '../components/workbuddy/client/model-label.js'
import { CodexMark } from '../components/codex/client/icon.js'

export const name = 'dsh-provider-model-label'
export const inject = ['slots']

export function apply(ctx: Context, config: { providers: string[] }): void {
  const slots = ctx.slots as unknown as {
    inject(name: string, callback: () => () => void): void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
  // Both providers share this single slot; DSH's default label has priority 0.
  slots.inject('conversation.input.model.label', () => slots.register({
    name: 'conversation.input.model.label', priority: -20,
  }, (props: ModelNameLabelProps) => <ModelNameLabel {...props} providers={config.providers} />))
}

function ModelNameLabel(props: ModelNameLabelProps & { providers: string[] }) {
  if (!props.providers.includes(props.provider?.id ?? '')) return <span>{props.model?.name ?? props.model?.id ?? ''}</span>
  if (props.provider?.id !== 'codex') return <WorkBuddyModelNameLabel {...props} />
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
    <CodexMark />
    <span>{props.model?.name ?? props.model?.id ?? ''}</span>
  </span>
}
