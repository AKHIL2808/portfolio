// F.3/W.03: scroll system. Key rules, next/previous stop math, named locks, and the
// Lenis + ScrollTrigger + gsap.ticker + keyboard wiring (Lenis replaced by a fake).
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  type Cb = (...args: unknown[]) => void;
  class FakeLenis {
    static instances: FakeLenis[] = [];
    scroll = 0;
    targetScroll = 0;
    limit = 4000;
    isStopped = false;
    listeners: [string, Cb][] = [];
    offs: ReturnType<typeof vi.fn>[] = [];
    raf = vi.fn();
    scrollTo = vi.fn();
    destroy = vi.fn();
    stop = vi.fn(() => {
      this.isStopped = true;
    });
    start = vi.fn(() => {
      this.isStopped = false;
    });
    constructor(public options: unknown) {
      FakeLenis.instances.push(this);
    }
    on(event: string, cb: Cb) {
      this.listeners.push([event, cb]);
      const off = vi.fn();
      this.offs.push(off);
      return off;
    }
  }
  return { FakeLenis };
});
vi.mock("lenis", () => ({ default: fake.FakeLenis }));

import * as scrollIndex from "@/experience/systems/scroll";
import { keyAction, nextStop, type KeyLike } from "@/experience/systems/scroll/keys";
import { createScrollLock } from "@/experience/systems/scroll/scrollLock";
import {
  getScroll,
  installScrollSystem,
  isScrollLocked,
  lockScroll,
  resetScrollSystem,
  setScrollStops,
  unlockScroll,
} from "@/experience/systems/scroll/scrollSystem";

/** A fake element whose closest() understands `tag`, `tag[attr]` and `[attr='v']` selectors. */
function el(tag: string, attrs: Record<string, string> = {}) {
  const one = (sel: string): boolean => {
    const m = /^(\w*)(?:\[([\w-]+)(?:='([^']*)')?\])?/.exec(sel.trim());
    if (!m) return false;
    const [, t, attr, value] = m;
    if (t && t !== tag) return false;
    if (attr === undefined) return Boolean(t);
    if (!(attr in attrs)) return false;
    return value === undefined || attrs[attr] === value;
  };
  return {
    isContentEditable: attrs.contenteditable === "true",
    closest: (selectors: string) => (selectors.split(",").some(one) ? {} : null),
  };
}
const ev = (key: string, extra: Partial<KeyLike> = {}): KeyLike => ({ key, target: null, ...extra });

describe("keyAction", () => {
  it.each([
    [" ", "next"],
    ["ArrowDown", "next"],
    ["ArrowUp", "prev"],
    ["PageDown", null],
    ["a", null],
    ["Enter", null],
  ])("%j → %s", (key, action) => {
    expect(keyAction(ev(key))).toBe(action);
  });

  it.each(["altKey", "ctrlKey", "metaKey", "shiftKey"] as const)("any modifier (%s) leaves the key native", (mod) => {
    for (const key of [" ", "ArrowDown", "ArrowUp"]) expect(keyAction(ev(key, { [mod]: true }))).toBeNull();
  });

  it("ignores a repeating Space but allows repeating arrows", () => {
    expect(keyAction(ev(" ", { repeat: true }))).toBeNull();
    expect(keyAction(ev("ArrowDown", { repeat: true }))).toBe("next");
  });

  it.each([
    ["input", el("input")],
    ["textarea", el("textarea")],
    ["select", el("select")],
    ["contenteditable", el("div", { contenteditable: "true" })],
  ])("typing in %s never scrolls", (_name, target) => {
    for (const key of [" ", "ArrowDown", "ArrowUp"]) expect(keyAction(ev(key, { target }))).toBeNull();
  });

  it.each([
    ["button", el("button")],
    ["a[href]", el("a", { href: "#" })],
    ["[role=button]", el("div", { role: "button" })],
    ["summary", el("summary")],
    ["[role=link]", el("div", { role: "link" })],
    ["[role=checkbox]", el("div", { role: "checkbox" })],
  ])("Space on %s stays native; arrows still advance", (_name, target) => {
    expect(keyAction(ev(" ", { target }))).toBeNull();
    expect(keyAction(ev("ArrowDown", { target }))).toBe("next");
    expect(keyAction(ev("ArrowUp", { target }))).toBe("prev");
  });

  it("Space on a link without href or a plain element advances", () => {
    expect(keyAction(ev(" ", { target: el("a") }))).toBe("next");
    expect(keyAction(ev(" ", { target: el("div") }))).toBe("next");
    expect(keyAction(ev(" ", { target: {} }))).toBe("next");
  });
});

describe("nextStop", () => {
  const stops = [0, 500, 1200, 2000];
  const page = { start: 0, end: 2000 };

  it.each([
    [250, "next", 500],
    [250, "prev", 0],
    [500, "next", 1200], // on a stop moves on
    [500, "prev", 0],
    [2000, "next", 2000], // stays at the act's end
    [0, "prev", 0], // never before the act's start
  ] as const)("from %s, %s → %s", (current, direction, expected) => {
    expect(nextStop(stops, current, direction, page, 800)).toBe(expected);
  });

  it("stays inside the act's range and ignores stops outside it", () => {
    const act = { start: 500, end: 1200 };
    expect(nextStop(stops, 1200, "next", act, 800)).toBe(1200);
    expect(nextStop(stops, 500, "prev", act, 800)).toBe(500);
    expect(nextStop(stops, 600, "next", act, 800)).toBe(1200);
    expect(nextStop(stops, 1100, "prev", act, 800)).toBe(500);
  });

  it("past the last stop goes to the act's edge", () => {
    expect(nextStop([500], 600, "next", page, 800)).toBe(2000);
    expect(nextStop([500], 400, "prev", page, 800)).toBe(0);
  });

  it("with no stops moves one step, clamped to the act", () => {
    const tall = { start: 0, end: 4000 };
    expect(nextStop([], 0, "next", tall, 800)).toBe(800);
    expect(nextStop([], 800, "prev", tall, 800)).toBe(0);
    expect(nextStop([], 3500, "next", tall, 800)).toBe(4000);
    expect(nextStop([], 300, "prev", tall, 800)).toBe(0);
  });
});

describe("scrollLock (named locks)", () => {
  const target = () => ({ stop: vi.fn(), start: vi.fn() });

  it("stops on the first reason and starts when the last one is released", () => {
    const t = target();
    const lock = createScrollLock();
    lock.attach(t);
    lock.lock("beat");
    lock.lock("gate:1.7");
    expect(t.stop).toHaveBeenCalledOnce();
    lock.unlock("beat");
    expect(t.start).not.toHaveBeenCalled();
    expect(lock.isLocked()).toBe(true);
    lock.unlock("gate:1.7");
    expect(t.start).toHaveBeenCalledOnce();
    expect(lock.isLocked()).toBe(false);
  });

  it("unlocking a reason that isn't held does nothing", () => {
    const t = target();
    const lock = createScrollLock();
    lock.attach(t);
    lock.unlock("nope");
    lock.lock("beat");
    lock.unlock("nope");
    expect(t.start).not.toHaveBeenCalled();
    expect(lock.isLocked()).toBe(true);
  });

  it("no-argument calls use the default reason", () => {
    const t = target();
    const lock = createScrollLock();
    lock.attach(t);
    lock.lock();
    lock.unlock();
    expect(t.stop).toHaveBeenCalledOnce();
    expect(t.start).toHaveBeenCalledOnce();
  });

  it("a lock taken before attach is applied on attach", () => {
    const t = target();
    const lock = createScrollLock();
    lock.lock("beat");
    lock.attach(t);
    expect(t.stop).toHaveBeenCalledOnce();
  });
});

describe("scroll system wiring", () => {
  type WindowStub = {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    innerHeight: number;
  };
  let win: WindowStub;

  const instance = (i = 0) => {
    const l = fake.FakeLenis.instances[i];
    if (!l) throw new Error(`no Lenis instance [${i}]`);
    return l;
  };
  const keydownHandler = (): ((e: KeyboardEvent) => void) => {
    const call = win.addEventListener.mock.calls.find((c) => c[0] === "keydown");
    const handler: unknown = call?.[1];
    if (typeof handler !== "function") throw new Error("no keydown listener");
    return handler as (e: KeyboardEvent) => void;
  };
  const press = (key: string) => {
    const preventDefault = vi.fn();
    keydownHandler()({ key, target: null, preventDefault } as unknown as KeyboardEvent);
    return preventDefault;
  };

  beforeEach(() => {
    win = { addEventListener: vi.fn(), removeEventListener: vi.fn(), innerHeight: 800 };
    vi.stubGlobal("window", win);
    resetScrollSystem();
    fake.FakeLenis.instances.length = 0;
    vi.spyOn(gsap, "registerPlugin").mockImplementation(() => undefined);
  });

  afterEach(() => {
    resetScrollSystem(); // before unstubbing: uninstall uses window.removeEventListener
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("installs once: one Lenis, one ticker listener, one keydown listener", () => {
    const add = vi.spyOn(gsap.ticker, "add");
    installScrollSystem();
    installScrollSystem();
    expect(fake.FakeLenis.instances).toHaveLength(1);
    expect(add).toHaveBeenCalledOnce();
    expect(win.addEventListener).toHaveBeenCalledOnce();
    expect(win.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(gsap.registerPlugin).toHaveBeenCalledWith(ScrollTrigger);
  });

  it("creates Lenis with native touch, smooth wheel, reduced-motion support and no auto rAF", () => {
    installScrollSystem();
    expect(instance().options).toEqual({
      autoRaf: false,
      smoothWheel: true,
      syncTouch: false,
      respectReducedMotion: true,
    });
  });

  it("the ticker listener feeds Lenis real time in ms", () => {
    const add = vi.spyOn(gsap.ticker, "add");
    installScrollSystem();
    const listener: unknown = add.mock.calls[0]?.[0];
    if (typeof listener !== "function") throw new Error("no ticker listener");
    listener(1.5, 16, 1, 0);
    expect(instance().raf).toHaveBeenCalledWith(1500);
  });

  it("Lenis scroll events drive ScrollTrigger.update", () => {
    installScrollSystem();
    const scroll = instance().listeners.find(([event]) => event === "scroll");
    expect(scroll?.[1]).toBe(ScrollTrigger.update);
  });

  it("uninstall removes everything and destroys Lenis; a second uninstall is a no-op", () => {
    const add = vi.spyOn(gsap.ticker, "add");
    const remove = vi.spyOn(gsap.ticker, "remove");
    const uninstall = installScrollSystem();
    const listener = add.mock.calls[0]?.[0];
    const keydown = keydownHandler();
    const lenis = instance();
    remove.mockClear(); // gsap.ticker.add calls remove itself to avoid duplicates
    uninstall();
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith(listener);
    expect(win.removeEventListener).toHaveBeenCalledWith("keydown", keydown);
    expect(lenis.offs[0]).toHaveBeenCalledOnce();
    expect(lenis.destroy).toHaveBeenCalledOnce();
    uninstall();
    expect(lenis.destroy).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  });

  it("is StrictMode-safe: install → cleanup → install leaves one live Lenis", () => {
    const add = vi.spyOn(gsap.ticker, "add");
    installScrollSystem()();
    installScrollSystem();
    expect(fake.FakeLenis.instances).toHaveLength(2);
    expect(instance(0).destroy).toHaveBeenCalledOnce();
    expect(instance(1).destroy).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledTimes(2);
  });

  it("a lock taken before install is applied when Lenis is created", () => {
    lockScroll("beat");
    installScrollSystem();
    expect(instance().stop).toHaveBeenCalledOnce();
    expect(isScrollLocked()).toBe(true);
    unlockScroll("beat");
    expect(instance().start).toHaveBeenCalledOnce();
    expect(isScrollLocked()).toBe(false);
  });

  it("Arrow Down scrolls one screen by default; Space too; Arrow Up goes back", () => {
    installScrollSystem();
    const lenis = instance();
    expect(press("ArrowDown")).toHaveBeenCalledOnce();
    expect(lenis.scrollTo).toHaveBeenLastCalledWith(800);
    lenis.targetScroll = 800;
    press(" ");
    expect(lenis.scrollTo).toHaveBeenLastCalledWith(1600);
    press("ArrowUp");
    expect(lenis.scrollTo).toHaveBeenLastCalledWith(0);
  });

  it("the default range is the whole page", () => {
    installScrollSystem();
    const lenis = instance();
    lenis.targetScroll = 3500;
    press("ArrowDown");
    expect(lenis.scrollTo).toHaveBeenLastCalledWith(4000);
  });

  it("while locked, keys do nothing and aren't swallowed", () => {
    installScrollSystem();
    lockScroll();
    const preventDefault = press("ArrowDown");
    expect(preventDefault).not.toHaveBeenCalled();
    expect(instance().scrollTo).not.toHaveBeenCalled();
  });

  it("keys the rules ignore aren't swallowed", () => {
    installScrollSystem();
    expect(press("PageDown")).not.toHaveBeenCalled();
    expect(instance().scrollTo).not.toHaveBeenCalled();
  });

  it("uses the Director's stops and act range when set, and the default after null", () => {
    installScrollSystem();
    const lenis = instance();
    setScrollStops(() => ({ stops: [300, 900], range: { start: 0, end: 1000 } }));
    press("ArrowDown");
    expect(lenis.scrollTo).toHaveBeenLastCalledWith(300);
    lenis.targetScroll = 900;
    press("ArrowDown");
    expect(lenis.scrollTo).toHaveBeenLastCalledWith(1000);
    setScrollStops(null);
    lenis.targetScroll = 0;
    press("ArrowDown");
    expect(lenis.scrollTo).toHaveBeenLastCalledWith(800);
  });

  it("getScroll reads Lenis, and is 0 before install", () => {
    expect(getScroll()).toBe(0);
    installScrollSystem();
    instance().scroll = 1234;
    expect(getScroll()).toBe(1234);
  });

  it("importing the module touches neither window nor gsap.ticker", async () => {
    vi.unstubAllGlobals();
    vi.resetModules();
    const add = vi.spyOn(gsap.ticker, "add");
    await expect(import("@/experience/systems/scroll/scrollSystem")).resolves.toBeDefined();
    expect(add).not.toHaveBeenCalled();
    vi.stubGlobal("window", win);
  });

  it("the index re-exports the public API", () => {
    expect(scrollIndex.installScrollSystem).toBe(installScrollSystem);
    expect(scrollIndex.lockScroll).toBe(lockScroll);
    expect(scrollIndex.unlockScroll).toBe(unlockScroll);
    expect(scrollIndex.isScrollLocked).toBe(isScrollLocked);
    expect(scrollIndex.setScrollStops).toBe(setScrollStops);
    expect(scrollIndex.getScroll).toBe(getScroll);
    expect(Object.keys(scrollIndex)).not.toContain("resetScrollSystem");
  });
});
