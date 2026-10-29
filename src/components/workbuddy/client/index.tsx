import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-settings-controller/remote'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { WorkBuddyCard } from './provider-card.js'
import type { ConnectionActions } from './provider-card.js'
import type { CredentialActions } from './card.js'
import { CreditsBadge } from './credits-badge.js'
import type { SelectionSource } from './credits-badge.js'
import { ModelNameLabel } from './model-label.js'
import { API_KEY_REF } from '../credential.js'
import { REMOTE } from '../remote.js'
import { SETTINGS_NAMESPACE } from '../identity.js'

export const name = 'workbuddy-component-settings'
export const inject = ['slots', 'remote', 'remote.credentials', 'remote.settings']

/** The standard credentials Remote handles storage; environment sources are ignored. */
export async function apply(ctx: Context): Promise<void> {
  const dispose = await ctx.remote.$mount(REMOTE)
  ctx.effect(() => dispose)
  ctx.inject(['remote.workbuddyProvider'], mountCard)
  ctx.inject(['remote.workbuddyProvider', 'modelDirectories'], mountCredits)
  mountModelLabel(ctx)
}

/** Add a small mark before WorkBuddy model names in the composer's model selector. */
function mountModelLabel(ctx: Context): void {
  const slots = ctx.slots as unknown as {
    inject(name: string, callback: () => () => void): void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
  slots.inject('conversation.input.model.label', () => slots.register({
    // DSH ships its own default label in this single slot at priority 0.
    // A distinct priority lets our label shadow it without failing this plugin.
    name: 'conversation.input.model.label', priority: -20,
  }, ModelNameLabel))
}

/** Structural slice of the session model-selection service this component reads. */
interface ModelDirectories {
  directoryFor(sessionId: string): { store?: SelectionSource } | undefined
}

/** Register the session-header credit badge; the host read pairs ledger spend with the account balance. */
function mountCredits(ctx: Context): void {
  const credits = async (sessionId: string, refresh = false) => {
    const result = await ctx.remote.workbuddyProvider.credits(sessionId, refresh)
    if (!result.ok) throw new Error('WorkBuddy credits unavailable')
    return result.value
  }
  // Read the session's own model-selection store so the badge follows the
  // selected provider (WorkBuddy only). A missing service leaves it undefined.
  const selection = (sessionId: string): SelectionSource | undefined => {
    const directories = ctx.get('modelDirectories') as ModelDirectories | undefined
    if (!directories?.directoryFor) return undefined
    try { return directories.directoryFor(sessionId)?.store } catch { return undefined }
  }
  // The conversation header slot is declared by another client plugin, whose
  // types are not a dependency here; the runtime slot service is structural.
  const slots = ctx.slots as unknown as {
    inject(name: string, callback: () => () => void): void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
  slots.inject('conversation.session.header.utilities', () => slots.register({
    name: 'conversation.session.header.utilities', id: 'workbuddy-credits', order: -20,
    inject: () => ({ credits, selection }),
  }, CreditsBadge))
}

function mountCard(ctx: Context): void {
  const section = async () => {
    const response = await ctx.remote.settings.describe()
    if (!response.ok) throw new Error('Settings unavailable')
    const value = response.value.namespaces.find(item => item.ns === SETTINGS_NAMESPACE)
    if (!value) throw new Error('Provider unavailable')
    return { response: response.value, value }
  }
  const connection: ConnectionActions = {
    control: async action => {
      const result = await ctx.remote.workbuddyProvider.command(action)
      if (!result.ok) throw new Error('WorkBuddy operation unavailable')
      return result.value
    },
    status: async () => {
      const { response, value } = await section()
      const settings = (value.value as { workbuddy?: { mode?: string; workbuddyRegion?: string; contextWindow?: string } }).workbuddy ?? {}
      const mode = settings.mode === 'workbuddy' ? 'workbuddy' : 'api'
      const region = settings.workbuddyRegion === 'intl' ? 'intl' : 'cn'
      const context = settings.contextWindow === 'light' ? 'light' : settings.contextWindow === 'max' ? 'max' : 'middle'
      const login = mode === 'workbuddy' ? await connection.control('status') : undefined
      return { mode, region, context, writable: response.writable,
        ...(login ? { login: { configured: !!login.configured, source: login.source, issue: login.issue } } : {}) }
    },
    select: async (mode, region) => {
      const { value } = await section()
      const result = await ctx.remote.settings.update(value.ns, { workbuddy: { mode, workbuddyRegion: region } }, value.revision)
      if (!result.ok) throw new Error('Settings write refused')
    },
    context: async mode => {
      const { value } = await section()
      const result = await ctx.remote.settings.update(value.ns, { workbuddy: { contextWindow: mode } }, value.revision)
      if (!result.ok) throw new Error('Settings write refused')
    },
  }
  const actions: CredentialActions = {
    status: async () => {
      const ref = API_KEY_REF
      const response = await ctx.remote.credentials.describe([ref])
      if (!response.ok || !response.value[ref]) throw new Error('Credential state unavailable')
      const info = response.value[ref]
      return { configured: info.configured && info.source === 'file', writable: info.writable }
    },
    save: async value => {
      const trimmed = value.trim()
      if (!trimmed || /[^\x21-\x7e]/.test(trimmed)) throw new Error('Invalid credential')
      const response = await ctx.remote.credentials.set(API_KEY_REF, trimmed)
      if (!response.ok) throw new Error('Credential write refused')
    },
  }
  ctx.slots.inject('settings.models.footer', () => ctx.slots.register({
    name: 'settings.models.footer', id: 'workbuddy', order: 20,
    inject: () => ({ actions, connection }),
  }, WorkBuddyCard))
}
