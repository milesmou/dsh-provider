import { useEffect, useState } from 'react'
import type { TurnCreditsReply } from '../remote.js'

export interface TurnCreditsProps {
  sessionId?: string
  /** Structural slice of DSH's turnTail slot's turn location. */
  turn?: { turn: number; status: string }
  turnCredits(sessionId: string, turn: number): Promise<TurnCreditsReply>
}

/** The historical turn's provider determines this disclosure, not the current model selection. */
export function TurnCreditsBadge({ sessionId, turn, turnCredits }: TurnCreditsProps) {
  const number = turn?.turn
  const closed = turn?.status === 'closed'
  const [result, setResult] = useState<{ sessionId: string; turn: number; view: TurnCreditsReply }>()

  useEffect(() => {
    let live = true
    setResult(undefined)
    if (!sessionId || number === undefined || !closed) return
    void turnCredits(sessionId, number).then(view => {
      if (live) setResult({ sessionId, turn: number, view })
    }).catch(() => {
      // Without a ledger reply the historical provider is unknown (it may be Codex).
      if (live) setResult({ sessionId, turn: number, view: { tracked: false } })
    })
    return () => { live = false }
  }, [sessionId, number, closed, turnCredits])

  if (!closed) return null
  const view = result && result.sessionId === sessionId && result.turn === number ? result.view : undefined
  if (!view?.tracked) return null
  const text = view.used === undefined ? '本轮积分不可用'
    : view.partial ? `本轮已知消耗 ${view.used} 积分（部分）` : `本轮消耗 ${view.used} 积分`
  const title = view.partial ? '部分请求未返回有效扣费数据，无法确认本轮完整积分；已知消耗仅包含服务端返回的实际积分。'
      : '本轮回复及工具调用后续请求的实际积分之和；不含生成会话标题、上下文压缩等后台扣费，后台扣费计入右上角的会话总计。'
  return <span aria-label="本轮积分消耗" title={title}
    style={{ fontSize: 11, lineHeight: '20px', color: 'var(--dsw-alias-label-secondary, CanvasText)' }}>{text}</span>
}
