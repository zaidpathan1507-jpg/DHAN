import { useEffect, useRef, useState } from "react";

export function useCountUp(target, duration = 600) {
  const [value, setValue] = useState(target ?? 0);
  const prevTarget = useRef(target ?? 0);

  useEffect(() => {
    if (target === null || target === undefined) return;
    const from = prevTarget.current;
    const to = target;
    const start = performance.now();

    let frame;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (to - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        prevTarget.current = to;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
