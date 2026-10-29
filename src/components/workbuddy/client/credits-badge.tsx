import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { SelectionSource } from '../../../client/session-selection.js'
export type { SelectionSource } from '../../../client/session-selection.js'

/** What the host reports for one session's credit figures. */
export interface CreditsView {
  enabled: boolean
  sessionUsed?: number
  accountRemain?: number
  accountTotal?: number
  unit?: string
  plan?: string
  mode?: 'api' | 'workbuddy'
  updatedAt?: number
  stale?: boolean
  issue?: string
}

/** The provider the WorkBuddy component owns; the badge shows only for it. */
export const WORKBUDDY_PROVIDER = 'workbuddy'

export interface CreditsBadgeProps {
  /** Session-scope standard prop; optional so the type also admits the absent scope. */
  sessionId?: string
  /** Injected host read: session spend + account balance; `refresh` forces a new balance fetch. */
  credits: (sessionId: string, refresh?: boolean) => Promise<CreditsView>
  /** Injected access to a session's model-selection store; absent elsewhere. */
  selection?: (sessionId: string) => SelectionSource | undefined
  /** Session-local notification after a completed turn's charges have settled on the Host. */
  subscribeCredits?: (sessionId: string, listener: () => void) => () => void
}

const REFRESH_MS = 5000

/** Trim to at most two decimals without trailing zeros (0.01 → "0.01", 4940.52000002 → "4940.52"). */
function fmt(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return String(Math.round(value * 100) / 100)
}

const wrap: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none',
  height: 24, padding: '0 8px', borderRadius: 6, font: 'inherit', fontSize: 11, lineHeight: '16px',
  color: 'var(--dsw-alias-label-secondary, CanvasText)',
  background: 'color-mix(in srgb, currentColor 8%, transparent)',
  whiteSpace: 'nowrap', cursor: 'default',
}

const refreshButton: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: 0, margin: 0, border: 'none', background: 'transparent',
  color: 'inherit', cursor: 'pointer', lineHeight: 0, opacity: 0.7,
}

/**
 * Compact session credit indicator for the conversation header. It shows only
 * while the session's selected model belongs to the WorkBuddy provider (the
 * account whose credits these are), and renders this conversation's spend plus
 * the account balance. The balance is fetched once per session and then
 * projected locally; a small button re-fetches it on demand.
 */
export function CreditsBadge({ sessionId, credits, selection, subscribeCredits }: CreditsBadgeProps) {
  const [view, setView] = useState<CreditsView>()
  const [selected, setSelected] = useState<{ sessionId?: string; provider?: string | null; revision?: number }>({})
  const provider = selected.sessionId === sessionId ? selected.provider : undefined
  const selectionRevision = selected.sessionId === sessionId ? selected.revision : undefined
  const [refreshing, setRefreshing] = useState(false)
  const generation = useRef(0)
  const requestSequence = useRef(0)

  useEffect(() => {
    setSelected({})
    if (!sessionId) return
    let source: SelectionSource | undefined
    try { source = selection?.(sessionId) } catch { source = undefined }
    if (!source) return
    let live = true
    const store = source
    const read = () => {
      if (!live) return
      let current
      try { current = store.getSnapshot()?.current } catch { current = undefined }
      setSelected(previous => ({ sessionId, provider: current?.provider ?? null, revision: (previous.revision ?? 0) + 1 }))
    }
    read()
    let unsubscribe = () => {}
    try { unsubscribe = store.subscribe(read) } catch { /* no live store */ }
    return () => { live = false; unsubscribe() }
  }, [sessionId, selection])

  const readCredits = useCallback(async (force: boolean) => {
    if (!sessionId) return
    const current = generation.current
    const request = ++requestSequence.current
    try {
      const next = await credits(sessionId, force)
      if (generation.current === current && requestSequence.current === request) setView(next)
      return next
    } catch {
      if (generation.current === current && requestSequence.current === request) setView(previous => ({ enabled: true, mode: previous?.mode,
        issue: '积分读取失败，请稍后刷新。' }))
    }
  }, [sessionId, credits])

  useEffect(() => {
    const current = ++generation.current
    setView(undefined)
    setRefreshing(false)
    if (!sessionId || provider !== WORKBUDDY_PROVIDER) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let reading = false
    let queued = false
    const tick = async () => {
      if (reading) { queued = true; return }
      clearTimeout(timer)
      reading = true
      let next: CreditsView | undefined
      do {
        queued = false
        next = await readCredits(false)
      } while (queued && generation.current === current)
      reading = false
      if (generation.current === current) timer = setTimeout(() => { void tick() }, next?.mode === 'api' ? 60000 : REFRESH_MS)
    }
    const unsubscribe = subscribeCredits?.(sessionId, () => { void tick() })
    void tick()
    return () => { ++generation.current; clearTimeout(timer); unsubscribe?.() }
  }, [sessionId, readCredits, provider, selectionRevision, subscribeCredits])

  // Manual re-fetch of the account balance (the once-per-session snapshot).
  const refresh = async () => {
    if (!sessionId || refreshing) return
    const current = generation.current
    setRefreshing(true)
    try { await readCredits(true) }
    finally { if (generation.current === current) setRefreshing(false) }
  }

  if (!view?.enabled || provider !== WORKBUDDY_PROVIDER) return null

  const used = fmt(view.sessionUsed)
  const remain = view.accountRemain === undefined ? undefined : fmt(view.accountRemain)
  const title = [
    `本会话消耗：${used} ${view.unit ?? '积分'}`,
    '会话总计包含所有轮次，以及生成会话标题、上下文压缩等后台请求的扣费；本轮消耗仅统计当轮回复。',
    remain === undefined ? undefined : `账号剩余：${remain} ${view.unit ?? '积分'}`,
    view.accountTotal === undefined ? undefined : `总额度：${fmt(view.accountTotal)} ${view.unit ?? '积分'}`,
    view.plan ? `套餐：${view.plan}` : undefined,
    view.updatedAt === undefined ? undefined : `更新时间：${new Date(view.updatedAt).toLocaleString()}`,
    view.issue,
  ].filter(Boolean).join('\n')

  return <span title={title} style={wrap} aria-label={view.mode === 'api' ? 'CodeBuddy API 积分' : 'WorkBuddy 积分'}>
    <span>会话总计 {used}</span>
    <span style={{ opacity: 0.75 }}>· {remain === undefined ? '剩余不可用' : `剩余 ${remain}`}{view.stale ? '（缓存）' : ''}</span>
    <button type="button" onClick={event => { event.stopPropagation(); void refresh() }}
      disabled={refreshing} aria-label="刷新余额" title="刷新余额"
      style={{ ...refreshButton, opacity: refreshing ? 0.35 : refreshButton.opacity }}>
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M14 8a6 6 0 1 1-1.757-4.243" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M14 2.5V6h-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  </span>
}
