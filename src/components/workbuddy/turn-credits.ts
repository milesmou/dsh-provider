import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { CreditLedger } from './credits.js'
import type { TurnCreditsReply } from './remote.js'

/** Exact provider charges grouped by DSH turn, independently of account balances. */
export class TurnCredits {
  private readonly active = new Map<string, number>()
  private disposed = false

  constructor(private readonly ledger: CreditLedger) {}

  observe(sessionId: string, event: SessionEvent): void {
    if (this.disposed) return
    if (event.type === 'turn/start' || event.type === 'step/start') this.active.set(sessionId, event.data.turn)
    else if (event.type === 'turn/end' && this.active.get(sessionId) === event.data.turn) this.forget(sessionId)
  }

  forget(sessionId: string): void { this.active.delete(sessionId) }

  /** Capture the owning turn before the request; a late reply cannot charge a later turn. */
  begin(sessionId: string | undefined): ((credit?: number) => void) | undefined {
    const turn = sessionId ? this.active.get(sessionId) : undefined
    if (!sessionId || turn === undefined || this.disposed) return
    const key = JSON.stringify([sessionId, turn])
    let recorded = false
    return credit => {
      if (recorded || this.disposed) return
      recorded = true
      this.ledger.add(key + ':requests', 1)
      if (credit === undefined || !Number.isFinite(credit) || credit < 0) return
      this.ledger.add(key + ':known', 1)
      this.ledger.add(key + ':used', credit)
    }
  }

  read(sessionId: string, turn: number): TurnCreditsReply {
    const key = JSON.stringify([sessionId, turn])
    const requests = this.ledger.of(key + ':requests')
    if (!requests) return { tracked: false }
    const known = this.ledger.of(key + ':known')
    return { tracked: true, partial: known < requests,
      ...(known ? { used: this.ledger.of(key + ':used') } : {}) }
  }

  dispose(): Promise<void> {
    this.disposed = true
    this.active.clear()
    return this.ledger.persist()
  }
}
