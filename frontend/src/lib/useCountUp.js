import { useEffect, useRef, useState } from "react";

export function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(target ?? 0);
  const prevTarget = useRef(target ?? 0);

  useEffect(() => {
    if (target === null || target === undefined) return;
    const from = prevTarget.current;
    const to = target;
    prevTarget.current = to;

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || from === to) {
      setValue(to);
      return;
    }

    const start = performance.now();
    let frame;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      setValue(to);
    };

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (to - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        settled = true;
      }
    };
    frame = requestAnimationFrame(tick);

    // Safety net: guarantees the final value lands even if rAF never fires
    // (e.g. a backgrounded or non-compositing tab), since setTimeout isn't
    // tied to the paint pipeline the way requestAnimationFrame is.
    const fallback = setTimeout(finish, duration + 100);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fallback);
    };
  }, [target, duration]);

  return value;
}
