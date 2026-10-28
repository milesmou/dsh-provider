/**
 * WorkBuddy credit accounting. Two independent sources:
 *
 * - Per-session consumption: every chat completion's `usage` carries an exact
 *   `credit` charge (e.g. 0.01). The adapter reports each charge here, keyed by
 *   the DSH session id, so the UI can show what the current conversation spent.
 * - Account remaining: the billing meter endpoint returns the resource packages
 *   with cycle total / remaining / used capacities. That is the account balance.
 */

import { readFileSync } from 'node:fs'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

export interface AccountCredits {
  /** Sum of every package's cycle remaining capacity (the usable balance). */
  remain: number
  /** Sum of every package's cycle total capacity. */
  total: number
  /** Sum of every package's cycle used capacity. */
  used: number
  /** Subscription plan name, when the endpoint names one. */
  plan?: string
  /** Capacity unit the endpoint reports (usually `credits`). */
  unit: string
}

/** Billing meter path, on the same host as the model API. Note: no `/v2` prefix. */
export const BILLING_PATH = '/billing/meter/get-user-resource-summary'

const num = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
const round = (value: number): number => Math.round(value * 1e6) / 1e6

/**
 * Parse the billing meter's `data` object (the envelope's inner payload) into a
 * balance. Aggregates every resource package; falls back to `TotalCredits` for
 * the remaining balance when the endpoint reports no package list.
 */
export function parseBillingSummary(value: unknown): AccountCredits | undefined {
  if (!value || typeof value !== 'object') return undefined
  const data = value as Record<string, unknown>
  const packages = Array.isArray(data.Packages) ? data.Packages : []
  let total = 0
  let remain = 0
  let used = 0
  let unit = 'credits'
  for (const entry of packages) {
    const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
    total += num(item.CycleTotalCapacity)
    remain += num(item.CycleRemainCapacity)
    used += num(item.CycleUsedCapacity)
    if (typeof item.CapacityUnit === 'string' && item.CapacityUnit) unit = item.CapacityUnit
  }
  if (!packages.length) {
    if (data.TotalCredits === undefined) return undefined
    remain = num(data.TotalCredits)
    total = remain
  }
  const plan = typeof data.SubscriptionPackageName === 'string' && data.SubscriptionPackageName
    ? data.SubscriptionPackageName : undefined
  return { remain: round(remain), total: round(total), used: round(used), unit, ...(plan ? { plan } : {}) }
}

/**
 * A once-fetched account balance plus the session spend at that moment. The
 * badge fetches this snapshot when the session starts and then projects the
 * remaining balance locally from the ledger, so no further billing request is
 * made until the user asks for a refresh.
 */
export interface SessionBalance {
  /** Account remaining capacity at the moment of the fetch. */
  remain: number
  /** Account total capacity at the moment of the fetch. */
  total: number
  unit: string
  plan?: string
  /** This session's accumulated spend when the snapshot was taken. */
  usedAtFetch: number
}

/**
 * Project the account remaining balance from a snapshot and the session's
 * current spend: anything spent after the fetch is subtracted, never below 0.
 */
export function projectRemain(balance: SessionBalance, sessionUsed: number): number {
  const spentSinceFetch = sessionUsed - balance.usedAtFetch
  const remaining = spentSinceFetch > 0 ? balance.remain - spentSinceFetch : balance.remain
  return round(Math.max(0, remaining))
}

/**
 * Per-session credit ledger. Holds one running total per DSH session id. When a
 * backing file is supplied the totals are loaded on construction and written
 * back on change, so reopening a session after a restart keeps its spend.
 */
export class CreditLedger {
  private readonly bySession = new Map<string, number>()
  private saveTimer?: ReturnType<typeof setTimeout>

  constructor(private readonly filename?: string) {
    if (filename) this.restore()
  }

  /** Add one request's credit charge to its session (ignored without a session or a valid charge). */
  add(sessionId: string | undefined, credit: number): void {
    if (!sessionId || !Number.isFinite(credit) || credit <= 0) return
    const key = String(sessionId)
    this.bySession.set(key, round((this.bySession.get(key) ?? 0) + credit))
    this.scheduleSave()
  }

  /** Total credits charged to one session, or 0 when it has spent none yet. */
  of(sessionId: string | undefined): number {
    return sessionId ? this.bySession.get(String(sessionId)) ?? 0 : 0
  }

  /** Flush any pending write immediately (used on disposal and by tests). */
  async persist(): Promise<void> {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = undefined }
    await this.write()
  }

  private restore(): void {
    if (!this.filename) return
    try {
      const data: unknown = JSON.parse(readFileSync(this.filename, 'utf8'))
      if (!data || typeof data !== 'object') return
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const total = Number(value)
        if (key && Number.isFinite(total) && total > 0) this.bySession.set(key, round(total))
      }
    } catch {
      // Missing or corrupt ledger: start empty rather than block startup.
    }
  }

  private scheduleSave(): void {
    if (!this.filename || this.saveTimer) return
    this.saveTimer = setTimeout(() => { this.saveTimer = undefined; void this.write() }, 100)
    // Never keep the host process alive just to flush a ledger.
    this.saveTimer.unref?.()
  }

  private async write(): Promise<void> {
    if (!this.filename) return
    const data: Record<string, number> = {}
    for (const [key, total] of this.bySession) if (total > 0) data[key] = round(total)
    try {
      await writeFileAtomic(this.filename, JSON.stringify(data, null, 2), { mode: 0o600, dirMode: 0o700 })
    } catch {
      // A failed ledger write must not fail the request that earned the charge.
    }
  }
}

