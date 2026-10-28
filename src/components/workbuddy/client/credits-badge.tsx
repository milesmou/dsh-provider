import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

/** What the host reports for one session's credit figures. */
export interface CreditsView {
  enabled: boolean
  sessionUsed?: number
  accountRemain?: number
  accountTotal?: number
  unit?: string
  plan?: string
}

export interface CreditsBadgeProps {
  /** Session-scope standard prop; optional so the type also admits the absent scope. */
  sessionId?: string
  /** Injected host read: session spend + account balance. */
  credits: (sessionId: string) => Promise<CreditsView>
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

/**
 * Compact session credit indicator for the conversation header: this
 * conversation's accumulated spend and the account's remaining balance,
 * refreshed on an interval while mounted. Renders nothing outside WorkBuddy
 * login mode or before the first successful read.
 */
export function CreditsBadge({ sessionId, credits }: CreditsBadgeProps) {
  const [view, setView] = useState<CreditsView>()
  useEffect(() => {
    if (!sessionId) return
    let live = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const next = await credits(sessionId)
        if (live) setView(next)
      } catch {
        // Keep the last known figures on a transient failure.
      } finally {
        if (live) timer = setTimeout(() => { void tick() }, REFRESH_MS)
      }
    }
    void tick()
    return () => { live = false; clearTimeout(timer) }
  }, [sessionId, credits])

  if (!view?.enabled) return null
  const used = fmt(view.sessionUsed ?? 0)
  const remain = view.accountRemain === undefined ? undefined : fmt(view.accountRemain)
  const title = [
    `本会话消耗：${used} ${view.unit ?? '积分'}`,
    remain === undefined ? undefined : `账号剩余：${remain} ${view.unit ?? '积分'}`,
    view.accountTotal === undefined ? undefined : `总额度：${fmt(view.accountTotal)} ${view.unit ?? '积分'}`,
    view.plan ? `套餐：${view.plan}` : undefined,
  ].filter(Boolean).join('\n')

  return <span title={title} style={wrap} aria-label="WorkBuddy 积分">
    <span>本会话 {used}</span>
    {remain === undefined ? null : <span style={{ opacity: 0.75 }}>· 剩余 {remain}</span>}
  </span>
}
