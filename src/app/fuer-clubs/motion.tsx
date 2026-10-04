"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Pinned phone next to the story steps: shows the screen of the step in the middle of the viewport. */
export function StoryPhone({ screens }: { screens: ReactNode[] }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const steps = [...document.querySelectorAll<HTMLElement>(".fc .step")];
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(Number(e.target.getAttribute("data-i")))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    steps.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    document.querySelectorAll(".fc .step").forEach((s, i) => s.classList.toggle("on", i === active));
  }, [active]);
  return (
    <div className="pin" aria-hidden="true">
      <div className="phone">
        <div className="screens">
          {screens.map((s, i) => (
            <div key={i} className={i === active ? "on" : undefined}>
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Role = { id: string; label: string; big: string; sub: string; items: [string, string][] };

/** Role tabs with a sliding pill; arrow keys move between tabs. */
export function RoleTabs({ roles }: { roles: Role[] }) {
  const [sel, setSel] = useState(0);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const ind = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const place = () => {
      const b = btns.current[sel];
      if (!b || !ind.current) return;
      ind.current.style.width = `${b.offsetWidth}px`;
      ind.current.style.transform = `translateX(${b.offsetLeft}px)`;
    };
    place();
    document.fonts?.ready.then(place);
    addEventListener("resize", place);
    return () => removeEventListener("resize", place);
  }, [sel]);
  const pick = (i: number) => {
    setSel(i);
    btns.current[i]?.focus();
  };
  return (
    <>
      <div className="tablist" role="tablist" aria-label="Rollen">
        <span ref={ind} className="pill-ind" aria-hidden="true" />
        {roles.map((r, i) => (
          <button
            key={r.id}
            ref={(el) => {
              btns.current[i] = el;
            }}
            role="tab"
            id={`t-${r.id}`}
            aria-controls={`p-${r.id}`}
            aria-selected={i === sel}
            tabIndex={i === sel ? 0 : -1}
            onClick={() => setSel(i)}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
              if (d) pick((i + d + roles.length) % roles.length);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      {roles.map((r, i) => (
        <div key={r.id} className="panel" role="tabpanel" id={`p-${r.id}`} aria-labelledby={`t-${r.id}`} hidden={i !== sel}>
          <div>
            <div className="big">{r.big}</div>
            <p>{r.sub}</p>
          </div>
          <div className="flist">
            {r.items.map(([h, p]) => (
              <div key={h}>
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
