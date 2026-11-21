// Midnight to Dawn: named scroll locks (F.3/W.03).
// Beats and gates can overlap (1.7 is a beat with a read gate), so each lock has a
// reason and the page stays locked until every reason is released. Reasons are a set,
// not a count: locking the same reason twice and unlocking it once releases it.
// No-argument calls use "default", so the TDD's lockScroll() / unlockScroll() still work.

export interface LockTarget {
  stop(): void;
  start(): void;
}

export interface ScrollLock {
  lock(reason?: string): void;
  unlock(reason?: string): void;
  isLocked(): boolean;
  /** Connects the thing to stop/start; locks taken before this are applied now. */
  attach(target: LockTarget): void;
  /** Disconnects it; held reasons are kept, so a re-attach stays locked. */
  detach(): void;
  /** Tests only: release everything and disconnect. */
  reset(): void;
}

export function createScrollLock(): ScrollLock {
  const reasons = new Set<string>();
  let target: LockTarget | null = null;
  return {
    lock(reason = "default") {
      const wasLocked = reasons.size > 0;
      reasons.add(reason);
      if (!wasLocked) target?.stop();
    },
    unlock(reason = "default") {
      if (!reasons.delete(reason)) return;
      if (reasons.size === 0) target?.start();
    },
    isLocked: () => reasons.size > 0,
    attach(next) {
      target = next;
      if (reasons.size > 0) next.stop();
    },
    detach() {
      target = null;
    },
    reset() {
      reasons.clear();
      target = null;
    },
  };
}
