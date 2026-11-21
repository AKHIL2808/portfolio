"use client";
// Scroll system smoke page (F.3/W.03): lock/unlock, keyboard advance, and a `scrub: true`
// tween that must keep up with scroll in slow motion. Status lives in data attributes
// written through a ref (no React state), updated from Lenis scroll events.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";
import { getScroll, installScrollSystem, isScrollLocked, lockScroll, unlockScroll } from "@/experience/systems/scroll";
// Not the time barrel: it pulls in R3F through useActFrame.
import { getTimeScale, installTimeSystem } from "@/experience/systems/time/timeSystem";
import { useStore } from "@/store/useStore";

const SCREENS = [1, 2, 3, 4, 5];
const STARTUP_MS = 700; // ScrollTrigger's startup delayedCall is 0.5 s; a margin on top

export default function ScrollSmoke() {
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const status = statusRef.current;
    if (!status) return;
    const uninstallTime = installTimeSystem();
    const uninstallScroll = installScrollSystem();
    const proxy = { p: 0 };
    // scrub: true sets the tween's progress straight from scroll, so slow motion can't stretch it.
    const tween = gsap.to(proxy, {
      p: 1,
      ease: "none",
      onUpdate: () => {
        status.dataset.progress = proxy.p.toFixed(4);
      },
      scrollTrigger: {
        trigger: document.documentElement,
        start: 0,
        end: "max",
        scrub: true,
        onUpdate: (self) => {
          status.dataset.scroll = String(Math.round(getScroll()));
          status.dataset.limit = String(Math.round(self.end));
        },
      },
    });
    status.dataset.scroll = "0";
    status.dataset.progress = "0";
    status.dataset.limit = String(Math.round(ScrollTrigger.maxScroll(window)));
    status.dataset.locked = String(isScrollLocked());
    status.dataset.timeScale = String(getTimeScale());
    // Ready only after ScrollTrigger's startup phase (a 0.5 s gsap.delayedCall after the plugin
    // registers). During it, scroll progress is applied directly and scrub tweens are skipped, so
    // a numeric scrub (the bug the slow-motion test guards) would go unnoticed. Real-time timer,
    // so it isn't stretched by slow motion.
    const readyTimer = window.setTimeout(() => {
      status.dataset.ready = "true";
    }, STARTUP_MS);
    return () => {
      window.clearTimeout(readyTimer);
      status.dataset.ready = "false";
      tween.scrollTrigger?.kill();
      tween.kill();
      uninstallScroll();
      uninstallTime();
    };
  }, []);

  const writeLocked = (): void => {
    const status = statusRef.current;
    if (status) status.dataset.locked = String(isScrollLocked());
  };

  const slowMotion = (): void => {
    useStore.getState().setTimeScale(0.05);
    const status = statusRef.current;
    if (status) status.dataset.timeScale = String(getTimeScale());
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-10 flex flex-col gap-2 rounded bg-black/70 p-3 text-sm">
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => {
              lockScroll();
              writeLocked();
            }}
          >
            Lock
          </button>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={() => {
              unlockScroll();
              writeLocked();
            }}
          >
            Unlock
          </button>
          <button type="button" className="rounded border px-2 py-1" onClick={slowMotion}>
            Slow motion
          </button>
        </div>
        <div ref={statusRef} data-testid="scroll-status" aria-live="off">
          Scroll smoke (dev): status in data attributes
        </div>
      </div>
      <main>
        {SCREENS.map((n) => (
          <section key={n} className="flex h-screen items-center justify-center border-b border-white/20 text-4xl">
            Screen {n}
          </section>
        ))}
      </main>
    </>
  );
}
