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
      <div className="loader-spinner">
        <div className="loader-ring" />
        <svg className="loader-boat" viewBox="0 0 24 24" fill="none">
          <path d="M3 15 Q12 22 21 15 L19 19 Q12 24 5 19 Z" fill="#0B4F6C" />
          <line x1="12" y1="15" x2="12" y2="4" stroke="#5C3A21" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M12 6 L18 12 L12 14 Z" fill="#E8A33D" />
        </svg>
      </div>
      <p className="loader-welcome" ref={textRef} />
    </div>
  );
}
