import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

/** Host read: the exact credit charge of the Turn that owns one assistant message. */
export interface TurnCreditReads {
  turnCredit(sessionId: string, messageId: string): Promise<{ credits?: number }>
}

/** Owner plus standard props the turn's assistant-action row supplies. */
export interface TurnCreditProps extends TurnCreditReads {
  sessionId?: string
  messageId?: string
}

/** One message's turn-credit outcome: nothing is rendered until a charge is known. */
type CreditState =
  | { status: 'pending' }
  | { status: 'found'; credits: number }
  | { status: 'absent' }

const pill: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', flex: 'none',
  height: 20, padding: '0 7px', borderRadius: 6,
  font: 'inherit', fontSize: 11, lineHeight: '16px',
  color: 'var(--dsw-alias-label-tertiary, GrayText)',
  background: 'color-mix(in srgb, currentColor 9%, transparent)',
  whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
}

/** Round to at most three decimals without trailing zeros (0.03 → "0.03"). */
function fmt(value: number): string {
  return String(Math.round(value * 1000) / 1000)
}

/**
 * Appends one Turn's credit spend to the assistant action row. It reads the
 * charge from the durable session log through the host Remote, so it appears
 * only for providers that record an exact credit (WorkBuddy). Messages with
 * no known charge — another provider, an old session, or a failed read — render
 * nothing at all instead of a permanent placeholder.
 */
export function TurnCredit({ sessionId, messageId, turnCredit }: TurnCreditProps) {
  const [state, setState] = useState<CreditState>({ status: 'pending' })

  useEffect(() => {
    setState({ status: 'pending' })
    if (!sessionId || !messageId) {
      setState({ status: 'absent' })
      return
    }
    let live = true
    void turnCredit(sessionId, messageId)
      .then(value => {
        if (!live) return
        setState(value.credits === undefined
          ? { status: 'absent' }
          : { status: 'found', credits: value.credits })
      })
      .catch(() => {
        if (live) setState({ status: 'absent' })
      })
    return () => { live = false }
  }, [sessionId, messageId, turnCredit])

  if (state.status !== 'found') return null
  return <span style={pill} title={`本轮对话积分消耗 ${fmt(state.credits)} 积分`}>本轮 {fmt(state.credits)} 积分</span>
}
