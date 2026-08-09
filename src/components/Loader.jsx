<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>Loader Preview</title>
<style>
  :root{
    --bg-1:#050b09;
    --bg-2:#0b201c;
    --accent:#5eead4;
    --accent-strong:#9dfff0;
    --ring:rgba(94,234,212,.28);
    --ring-soft:rgba(94,234,212,.12);
    --text-primary:#eafffa;
    --text-accent:#5eead4;
    --code-text:rgba(140,214,198,.32);
  }
  *{box-sizing:border-box}
  html,body{height:100%;margin:0}
  body{
    display:flex;align-items:center;justify-content:center;
    background:
      radial-gradient(circle at 30% 35%, rgba(94,234,212,.10), transparent 55%),
      linear-gradient(160deg,var(--bg-1),var(--bg-2) 60%,var(--bg-1));
    font-family:'Segoe UI',system-ui,sans-serif;
    overflow:hidden;
  }

  .loader{
    position:relative;
    width:min(92vw,720px);
    height:420px;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    border-radius:18px;
    overflow:hidden;
    background:
      linear-gradient(160deg,rgba(5,11,9,.85),rgba(11,32,28,.85));
    box-shadow:0 0 60px rgba(94,234,212,.06) inset;
  }

  /* faint grid, like a circuit board */
  .loader::before{
    content:"";
    position:absolute;inset:0;
    background-image:
      linear-gradient(var(--ring-soft) 1px, transparent 1px),
      linear-gradient(90deg, var(--ring-soft) 1px, transparent 1px);
    background-size:36px 36px;
    opacity:.35;
    mask-image:radial-gradient(circle at 38% 45%, black 0%, transparent 70%);
  }

  /* decorative scrolling code columns, like the reference image */
  .loader-code{
    position:absolute;
    top:0;right:0;
    width:34%;
    height:100%;
    overflow:hidden;
    font-family:'Consolas','Courier New',monospace;
    font-size:10px;
    line-height:1.6;
    color:var(--code-text);
    padding:14px;
    white-space:pre;
    pointer-events:none;
    -webkit-mask-image:linear-gradient(to bottom, transparent, black 12%, black 88%, transparent);
    mask-image:linear-gradient(to bottom, transparent, black 12%, black 88%, transparent);
  }
  .loader-code span{display:block;animation:scrollUp 14s linear infinite}

  .loader-spinner{
    position:relative;
    width:200px;height:200px;
    display:flex;align-items:center;justify-content:center;
  }

  .loader-ring, .loader-ring-inner{
    position:absolute;
    border-radius:50%;
    border:1.5px solid transparent;
  }
  .loader-ring{
    inset:0;
    border-top-color:var(--accent);
    border-right-color:var(--ring);
    animation:spin 3.2s linear infinite;
  }
  .loader-ring-inner{
    inset:26px;
    border-bottom-color:var(--accent-strong);
    border-left-color:var(--ring);
    animation:spin 2.4s linear infinite reverse;
  }
  .loader-dot{
    position:absolute;
    width:16px;height:16px;
    border-radius:50%;
    border:2px solid var(--ring);
    background:radial-gradient(circle, rgba(94,234,212,.15), transparent 70%);
  }
  .loader-dot.d1{left:-6px;bottom:34px}
  .loader-dot.d2{left:44px;bottom:-8px}

  .loader-lock{
    width:96px;height:96px;
    filter:drop-shadow(0 0 6px var(--accent)) drop-shadow(0 0 18px rgba(94,234,212,.5));
    animation:pulse 2.6s ease-in-out infinite;
  }

  .loader-welcome{
    margin-top:26px;
    font-size:17px;
    letter-spacing:.4px;
    color:var(--text-primary);
    text-align:center;
    min-height:1.4em;
  }
  .loader-welcome span{
    display:inline-block;
    opacity:0;
    transform:translateY(6px);
    animation:charIn .5s ease forwards;
  }
  .loader-welcome span.loader-accent{
    color:var(--text-accent);
    text-shadow:0 0 10px rgba(94,234,212,.55);
    font-weight:600;
  }

  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{
    0%,100%{filter:drop-shadow(0 0 6px var(--accent)) drop-shadow(0 0 16px rgba(94,234,212,.45))}
    50%{filter:drop-shadow(0 0 10px var(--accent-strong)) drop-shadow(0 0 26px rgba(94,234,212,.75))}
  }
  @keyframes charIn{to{opacity:1;transform:translateY(0)}}
  @keyframes scrollUp{
    0%{transform:translateY(0)}
    100%{transform:translateY(-50%)}
  }
</style>
</head>
<body>

<div class="loader">
  <div class="loader-code" id="codeCol"></div>

  <div class="loader-spinner">
    <div class="loader-ring"></div>
    <div class="loader-ring-inner"></div>
    <div class="loader-dot d1"></div>
    <div class="loader-dot d2"></div>

    <svg class="loader-lock" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M32 44 V32 a18 18 0 0 1 36 0 v12" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>
      <rect x="24" y="44" width="52" height="42" rx="6" stroke="var(--accent-strong)" stroke-width="3.2"/>
      <circle cx="50" cy="62" r="5" fill="var(--accent)"/>
      <path d="M50 67 v9" stroke="var(--accent)" stroke-width="3.2" stroke-linecap="round"/>
      <!-- circuit-style pixel notches around the lock body -->
      <g stroke="var(--accent)" stroke-width="2" opacity=".8">
        <path d="M24 54 h-6 M24 66 h-6 M24 78 h-6 M76 54 h6 M76 66 h6 M76 78 h6"/>
        <path d="M34 44 v-6 M42 44 v-6 M58 44 v-6 M66 44 v-6" opacity=".6"/>
      </g>
    </svg>
  </div>

  <p class="loader-welcome" id="welcomeText"></p>
</div>

<script>
  const WELCOME_TEXT = "Welcome, Teachers of SD Negeri Waria";
  const ACCENT_FROM = WELCOME_TEXT.indexOf("SD Negeri Waria");
  const el = document.getElementById("welcomeText");
  [...WELCOME_TEXT].forEach((ch, i) => {
    const span = document.createElement("span");
    span.textContent = ch === " " ? "\u00A0" : ch;
    span.style.animationDelay = `${i * 0.045}s`;
    if (i >= ACCENT_FROM) span.classList.add("loader-accent");
    el.appendChild(span);
  });

  // fake decorative code text, purely visual, mirrors the reference image
  const codeCol = document.getElementById("codeCol");
  const words = ["const","let","function","return","if","auth","token","verify","await","import","export","class","secure()","hash()","catch","try","init","render","state","props"];
  const lines = Array.from({length: 40}, () =>
    Array.from({length: 3}, () => words[Math.floor(Math.random()*words.length)]).join(" ")
  );
  const block = document.createElement("span");
  block.textContent = lines.concat(lines).join("\n");
  codeCol.appendChild(block);
</script>

</body>
</html>
