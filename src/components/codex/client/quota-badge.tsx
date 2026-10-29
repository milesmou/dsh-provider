import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuotaView } from '../remote.js'
import type { SelectionSource } from '../../../client/session-selection.js'
import { CodexMark } from './icon.js'

export interface QuotaBadgeProps {
  sessionId?: string
  read(refresh: boolean): Promise<QuotaView>
  selection(sessionId: string): SelectionSource | undefined
}

function windowLabel(window: QuotaView['windows'][number]): string {
  const mins = window.windowDurationMins
  if (mins === 10080) return '周'
  if (mins === undefined) return window.kind === 'primary' ? '主额度' : '次额度'
  if (mins % 1440 === 0) return `${mins / 1440}天`
  if (mins % 60 === 0) return `${mins / 60}h`
  return `${mins}分钟`
}

function remaining(used: number): string { return `${Math.round((100 - used) * 10) / 10}%` }

export function QuotaBadge({ sessionId, read, selection }: QuotaBadgeProps) {
  const [selected, setSelected] = useState<{ sessionId?: string; provider?: string }>({})
  const provider = selected.sessionId === sessionId ? selected.provider : undefined
  const [view, setView] = useState<QuotaView>()
  const [busy, setBusy] = useState(false)
  const generation = useRef(0)

  useEffect(() => {
    setSelected({})
    if (!sessionId) return
    let source: SelectionSource | undefined
    try { source = selection(sessionId) } catch { return }
    if (!source) return
    let live = true
    const update = () => {
      if (!live) return
      try { setSelected({ sessionId, provider: source.getSnapshot()?.current?.provider }) }
      catch { setSelected({ sessionId }) }
    }
    update()
    let unsubscribe = () => {}
    try { unsubscribe = source.subscribe(update) } catch { setSelected({ sessionId }) }
    return () => { live = false; unsubscribe() }
  }, [sessionId, selection])

  const refresh = useCallback(async (force: boolean) => {
    const current = generation.current
    setBusy(true)
    try {
      const next = await read(force)
      if (generation.current === current) setView(next)
    } catch {
      if (generation.current === current) setView({ available: false, windows: [], issue: '暂时无法读取 Codex 额度，请稍后刷新。' })
    } finally { if (generation.current === current) setBusy(false) }
  }, [read])

  useEffect(() => {
    const current = ++generation.current
    setView(undefined)
    setBusy(false)
    if (!sessionId || provider !== 'codex') return
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      await refresh(false)
      if (generation.current === current) timer = setTimeout(() => { void tick() }, 60000)
    }
    void tick()
    return () => { ++generation.current; clearTimeout(timer) }
  }, [sessionId, provider, refresh])

  if (!sessionId || provider !== 'codex') return null
  const summary = view?.available
    ? view.windows.map(window => `${windowLabel(window)} ${remaining(window.usedPercent)}`).join(' · ')
    : view ? '额度不可用' : '读取额度…'
  const details = ['Codex 账号共享额度', ...view?.windows.map(window => {
    const reset = window.resetsAt === undefined ? '' : `，重置：${new Date(window.resetsAt * 1000).toLocaleString()}`
    return `${windowLabel(window)}剩余 ${remaining(window.usedPercent)}${reset}`
  }) ?? [], view?.plan ? `套餐：${view.plan}` : undefined,
  view?.updatedAt ? `更新时间：${new Date(view.updatedAt).toLocaleString()}` : undefined,
  view?.issue, '点击刷新额度'].filter(Boolean).join('\n')

  return <button type="button" aria-label="Codex 剩余额度" aria-busy={busy} title={details} disabled={busy}
    onClick={event => { event.stopPropagation(); void refresh(true) }}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none', height: 26, padding: '0 8px',
      border: 'none', borderRadius: 6, font: 'inherit', fontSize: 11, color: 'var(--dsw-alias-label-secondary, CanvasText)',
      background: 'color-mix(in srgb, currentColor 8%, transparent)', whiteSpace: 'nowrap', cursor: busy ? 'default' : 'pointer' }}>
    <CodexMark size={16} />
    <span>{summary}{view?.stale ? '（缓存）' : ''}</span>
    <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ opacity: 0.65 }}>
      <path d="M14 8a6 6 0 1 1-1.757-4.243M14 2.5V6h-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
}
