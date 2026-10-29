import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
import { installSettingsNavIcon } from './settings-nav-icon.js'

export const PROVIDER_CARDS_SLOT = 'dsh-provider.settings.cards'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'dsh-provider.settings.cards': {
      kind: 'list'
      scope: 'root'
      owner: { children?: never }
    }
  }
}

export const name = 'dsh-provider-settings-page'
export const inject = ['slots']

export function apply(ctx: Context): void {
  installSettingsNavIcon(ctx, '模型扩展')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'dsh-provider-models', order: 11, label: '模型扩展',
    children: { [PROVIDER_CARDS_SLOT]: { kind: 'list', scope: 'root' } },
  }, ModelExtensionsPage))
}

function ModelExtensionsPage({ renderSlot }: PropsRenderSlots<typeof PROVIDER_CARDS_SLOT>) {
  return <div>
    {renderSlot(PROVIDER_CARDS_SLOT, {})}
  </div>
}
