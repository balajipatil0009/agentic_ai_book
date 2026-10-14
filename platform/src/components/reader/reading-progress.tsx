'use client';

import { useEffect, useState } from 'react';

/** Thin progress line pinned under the top bar while reading. */
export function ReadingProgress() {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        setValue(scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0);
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="fixed left-0 right-0 top-14 z-30 h-[2px] bg-white/[0.04] lg:left-64">
      <div
        className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-lime-300 transition-[width] duration-150 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
