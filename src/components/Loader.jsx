import { useEffect, useRef } from "react";
import "./Loader.css";

const WELCOME_TEXT = "Welcome, Teachers of SD Negeri Waria";
const ACCENT_FROM = WELCOME_TEXT.indexOf("SD Negeri Waria");

export default function Loader() {
  const textRef = useRef(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.innerHTML = "";
    [...WELCOME_TEXT].forEach((ch, i) => {
      const span = document.createElement("span");
      span.textContent = ch === " " ? "\u00A0" : ch;
      span.style.animationDelay = `${i * 0.045}s`;
      if (i >= ACCENT_FROM) span.classList.add("loader-accent");
      el.appendChild(span);
    });
  }, []);

  return (
    <div className="loader">
      <div className="loader-code" aria-hidden="true" />

      <div className="loader-spinner">
        <div className="loader-ring" />
        <div className="loader-ring-inner" />
        <div className="loader-dot d1" />
        <div className="loader-dot d2" />

        <svg className="loader-lock" viewBox="0 0 100 100" fill="none">
          <path d="M32 44 V32 a18 18 0 0 1 36 0 v12" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
          <rect x="24" y="44" width="52" height="42" rx="6" stroke="var(--accent-strong)" strokeWidth="3.2" />
          <circle cx="50" cy="62" r="5" fill="var(--accent)" />
          <path d="M50 67 v9" stroke="var(--accent)" strokeWidth="3.2" strokeLinecap="round" />
          <g stroke="var(--accent)" strokeWidth="2" opacity="0.8">
            <path d="M24 54 h-6 M24 66 h-6 M24 78 h-6 M76 54 h6 M76 66 h6 M76 78 h6" />
            <path d="M34 44 v-6 M42 44 v-6 M58 44 v-6 M66 44 v-6" opacity="0.6" />
          </g>
        </svg>
      </div>

      <p className="loader-welcome" ref={textRef} />
    </div>
  );
}
