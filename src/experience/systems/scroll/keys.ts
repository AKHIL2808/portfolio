// Midnight to Dawn: scroll keys (F.3/W.03, tdd › Core systems › 5).
// Pure: no DOM globals, Lenis or GSAP. A real KeyboardEvent fits KeyLike as-is.

export type KeyAction = "next" | "prev";

/** The parts of a DOM element the key rules need. */
export interface TargetLike {
  isContentEditable?: boolean;
  closest?(selectors: string): unknown;
}

export interface KeyLike {
  key: string;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  defaultPrevented?: boolean;
  target?: unknown;
}

export interface ScrollRange {
  start: number;
  end: number;
}

// Typing here must never scroll the page.
const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
// Space already does something on these (Tab + Space on the HUD must keep working).
const SPACE_ACTIVATES =
  "button, a[href], summary, [role='button'], [role='link'], [role='checkbox'], [role='switch'], " +
  "[role='radio'], [role='tab'], [role='menuitem'], [role='option']";
// px: standing on a stop (Lenis lands within 0.5 px) moves on to the next one.
const STOP_EPSILON = 1;

function asTarget(target: unknown): TargetLike | null {
  return typeof target === "object" && target !== null ? (target as TargetLike) : null;
}

function matches(target: TargetLike, selectors: string): boolean {
  return typeof target.closest === "function" && target.closest(selectors) != null;
}

/**
 * Space / Arrow Down → "next", Arrow Up → "prev"; null leaves the key to the browser:
 * any modifier (Shift+Space stays native), a repeating Space, a key another handler
 * already claimed, typing in a field, or Space on something Space activates.
 */
export function keyAction(e: KeyLike): KeyAction | null {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
  const isSpace = e.key === " ";
  const action: KeyAction | null = isSpace || e.key === "ArrowDown" ? "next" : e.key === "ArrowUp" ? "prev" : null;
  if (action === null || (isSpace && e.repeat)) return null;
  const target = asTarget(e.target);
  if (target) {
    if (target.isContentEditable === true || matches(target, EDITABLE)) return null;
    if (isSpace && matches(target, SPACE_ACTIVATES)) return null;
  }
  return action;
}

/**
 * The first stop strictly past `current` in `direction`, inside `range` (the current act).
 * Past the last stop it goes to the act's edge; with no stops it moves one `step`.
 * The result is always clamped to `range`, so Arrow Up never leaves the act.
 */
export function nextStop(
  stops: readonly number[],
  current: number,
  direction: KeyAction,
  range: ScrollRange,
  step: number,
): number {
  const lo = Math.min(range.start, range.end);
  const hi = Math.max(range.start, range.end);
  let target: number | undefined;
  for (const stop of stops) {
    if (stop < lo || stop > hi) continue;
    if (direction === "next") {
      if (stop > current + STOP_EPSILON && (target === undefined || stop < target)) target = stop;
    } else if (stop < current - STOP_EPSILON && (target === undefined || stop > target)) {
      target = stop;
    }
  }
  if (target === undefined) {
    if (stops.length > 0) target = direction === "next" ? hi : lo;
    else target = current + (direction === "next" ? 1 : -1) * (step > 0 ? step : 0);
  }
  return Math.min(hi, Math.max(lo, target));
}
