/** Exact provider charges grouped by DSH turn, independently of account balances. */
export class TurnCredits {
    ledger;
    active = new Map();
    disposed = false;
    constructor(ledger) {
        this.ledger = ledger;
    }
    observe(sessionId, event) {
        if (this.disposed)
            return;
        if (event.type === 'turn/start' || event.type === 'step/start')
            this.active.set(sessionId, event.data.turn);
        else if (event.type === 'turn/end' && this.active.get(sessionId) === event.data.turn)
            this.forget(sessionId);
    }
    forget(sessionId) { this.active.delete(sessionId); }
    /** Capture the owning turn before the request; a late reply cannot charge a later turn. */
    begin(sessionId) {
        const turn = sessionId ? this.active.get(sessionId) : undefined;
        if (!sessionId || turn === undefined || this.disposed)
            return;
        const key = JSON.stringify([sessionId, turn]);
        let recorded = false;
        return credit => {
            if (recorded || this.disposed)
                return;
            recorded = true;
            this.ledger.add(key + ':requests', 1);
            if (credit === undefined || !Number.isFinite(credit) || credit < 0)
                return;
            this.ledger.add(key + ':known', 1);
            this.ledger.add(key + ':used', credit);
        };
    }
    read(sessionId, turn) {
        const key = JSON.stringify([sessionId, turn]);
        const requests = this.ledger.of(key + ':requests');
        if (!requests)
            return { tracked: false };
        const known = this.ledger.of(key + ':known');
        return { tracked: true, partial: known < requests,
            ...(known ? { used: this.ledger.of(key + ':used') } : {}) };
    }
    dispose() {
        this.disposed = true;
        this.active.clear();
        return this.ledger.persist();
    }
}
//# sourceMappingURL=turn-credits.js.map