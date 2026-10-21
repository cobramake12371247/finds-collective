/* Finds Collective sound engine.
   Each site loads this with <script src="../sfx.js" data-theme="..."></script>.
   Every sound is synthesized live with Web Audio (no audio files) and matches the site's topic.
   "tap" plays on buttons, chips, toggles and checkboxes; "go" on calls to action and Amazon links; "tick" on sliders.
   A small mute button is added to every page and remembered per browser. */
(function () {
  const theme = (document.currentScript && document.currentScript.dataset.theme) || "hub";
  const KEY = "fc-sound";
  let on = true;
  try { on = localStorage.getItem(KEY) !== "off"; } catch (e) {}
  let ac = null, master = null;

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }

  // ---------- building blocks ----------
  function tone(type, f0, f1, dur, gain, at = 0, opts = {}) {
    const c = ctx(); if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur * (opts.bend || 1));
    if (opts.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = opts.vib; lg.gain.value = opts.vibDepth || 20; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur); }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, gain, at = 0, filt = "bandpass", freq = 2000, q = 1, f1) {
    const c = ctx(); if (!c) return;
    const t = c.currentTime + at, n = Math.max(1, Math.floor(c.sampleRate * dur));
    const b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = filt; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t);
  }
  function pluck(freq, gain = 0.4, at = 0, decay = 0.996, dur = 1.4) {
    const c = ctx(); if (!c) return;
    const sr = c.sampleRate, len = Math.floor(sr * dur), b = c.createBuffer(1, len, sr), d = b.getChannelData(0), N = Math.round(sr / freq);
    for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    for (let i = N; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + d[i - N - 1]);
    const s = c.createBufferSource(), g = c.createGain(); g.gain.value = gain; s.buffer = b; s.connect(g).connect(master); s.start(c.currentTime + at);
  }
  const bell = (f, g = 0.25, at = 0, dur = 0.9) => { tone("sine", f, f, dur, g, at); tone("sine", f * 2.76, f * 2.76, dur * 0.5, g * 0.35, at); tone("sine", f * 5.4, f * 5.4, dur * 0.25, g * 0.15, at); };
  const kick = (at = 0, g = 0.9) => tone("sine", 150, 45, 0.28, g, at);
  const snare = (at = 0) => { noise(0.18, 0.5, at, "highpass", 1500); tone("triangle", 220, 180, 0.08, 0.25, at); };
  const hat = (at = 0) => noise(0.05, 0.3, at, "highpass", 7000);

  // ---------- one sound set per site ----------
  const T = {
    "hub":            { tap: () => tone("sine", 660, 880, 0.08, 0.2), go: () => { tone("sine", 660, 660, 0.1, 0.18); tone("sine", 990, 990, 0.18, 0.18, 0.08); }, tick: () => tone("sine", 1200, 1200, 0.02, 0.06) },
    // home & kitchen
    "the-galley":     { tap: () => bell(1760, 0.18, 0, 0.5),                          // spoon on a glass
                        go: () => { bell(1320, 0.2); bell(1980, 0.16, 0.09); },
                        tick: () => noise(0.03, 0.25, 0, "bandpass", 900, 4) },       // knife tap on a board
    "no-drill-nest":  { tap: () => noise(0.16, 0.5, 0, "bandpass", 1800, 1.2, 4500), // painter's tape rip
                        go: () => { noise(0.22, 0.5, 0, "bandpass", 1200, 1, 5000); tone("sine", 180, 120, 0.08, 0.3, 0.2); },
                        tick: () => tone("square", 2400, 2400, 0.012, 0.04) },
    // beauty
    "shelfie-club":   { tap: () => tone("sine", 600, 1300, 0.12, 0.25, 0, { bend: 0.6 }), // water drop
                        go: () => { tone("sine", 500, 1100, 0.12, 0.22); tone("sine", 900, 1900, 0.14, 0.18, 0.1); },
                        tick: () => tone("sine", 1500, 1800, 0.03, 0.06) },
    "dupe-desk":      { tap: () => { noise(0.02, 0.5, 0, "highpass", 3000); tone("sine", 1800, 1200, 0.04, 0.12); }, // compact snapping shut
                        go: () => { [1568, 2093, 2637, 3136].forEach((f, i) => tone("triangle", f, f, 0.18, 0.08, i * 0.04)); }, // sparkle
                        tick: () => noise(0.015, 0.2, 0, "highpass", 5000) },
    // tech
    "desk-setup-lab": { tap: () => { noise(0.025, 0.55, 0, "bandpass", 3500, 2); tone("square", 180, 120, 0.03, 0.06, 0.01); }, // mechanical key
                        go: () => { [0, 0.06, 0.11].forEach((a) => noise(0.025, 0.5, a, "bandpass", 3200, 2)); tone("sine", 880, 880, 0.12, 0.12, 0.16); },
                        tick: () => noise(0.012, 0.3, 0, "bandpass", 4000, 3) },
    "pocket-kit":     { tap: () => { noise(0.02, 0.5, 0, "bandpass", 2500, 3); noise(0.02, 0.4, 0.035, "bandpass", 2200, 3); }, // split-flap clack
                        go: () => { bell(784, 0.2, 0, 0.7); bell(659, 0.2, 0.22, 0.9); }, // airport chime
                        tick: () => noise(0.015, 0.3, 0, "bandpass", 2600, 3) },
    // pets
    "good-boy-gear":  { tap: () => tone("sine", 900, 1700, 0.14, 0.2, 0, { vib: 30, vibDepth: 80 }),  // squeaky toy
                        go: () => { tone("sine", 300, 900, 0.12, 0.3); tone("sine", 700, 220, 0.2, 0.25, 0.12); }, // ball boing
                        tick: () => tone("sine", 1400, 1600, 0.03, 0.05) },
    "the-cat-shelf":  { tap: () => { [3200, 3900].forEach((f, i) => tone("sine", f, f, 0.25, 0.07, i * 0.03)); }, // collar bell
                        go: () => { tone("sawtooth", 380, 560, 0.18, 0.06, 0, { vib: 25, vibDepth: 30 }); tone("sine", 3600, 3600, 0.3, 0.06, 0.12); }, // "mrrp" + bell
                        tick: () => tone("sine", 3000, 3000, 0.04, 0.03) },
    // fashion
    "capsule-30":     { tap: () => { tone("triangle", 2300, 2200, 0.12, 0.1); tone("triangle", 3450, 3300, 0.08, 0.05); }, // hanger on a rail
                        go: () => { noise(0.25, 0.25, 0, "bandpass", 1500, 0.7, 600); tone("triangle", 2300, 2200, 0.12, 0.08, 0.15); }, // fabric swish
                        tick: () => tone("triangle", 2600, 2600, 0.03, 0.04) },
    "sole-search":    { tap: () => tone("sine", 1800, 2600, 0.09, 0.14, 0, { vib: 60, vibDepth: 120 }), // sneaker squeak
                        go: () => { tone("sine", 1600, 2800, 0.08, 0.14, 0, { vib: 70, vibDepth: 140 }); tone("sine", 2200, 1500, 0.1, 0.12, 0.1, { vib: 70, vibDepth: 140 }); },
                        tick: () => tone("sine", 2400, 2400, 0.02, 0.04) },
    // health
    "lights-out-lab": { tap: () => bell(1046, 0.1, 0, 1.1),                        // music-box note
                        go: () => { [784, 659, 523].forEach((f, i) => bell(f, 0.1, i * 0.18, 1.2)); },
                        tick: () => tone("sine", 880, 880, 0.05, 0.03) },
    "daily-reset":    { tap: () => tone("square", 2000, 2000, 0.06, 0.07),          // stopwatch beep
                        go: () => tone("sine", 2600, 3100, 0.35, 0.12, 0, { vib: 28, vibDepth: 160 }), // coach's whistle
                        tick: () => tone("square", 1800, 1800, 0.015, 0.04) },
    // gaming
    "respawn-room":   { tap: () => tone("square", 880, 1320, 0.06, 0.07, 0, { bend: 0.3 }), // menu blip
                        go: () => { tone("square", 988, 988, 0.08, 0.07); tone("square", 1319, 1319, 0.22, 0.07, 0.08); }, // coin
                        tick: () => tone("square", 660, 660, 0.02, 0.04) },
    "couch-coop":     { tap: () => tone("square", 300, 900, 0.12, 0.06),           // jump
                        go: () => { [523, 659, 784, 1047].forEach((f, i) => tone("square", f, f, 0.08, 0.06, i * 0.06)); }, // power-up
                        tick: () => tone("triangle", 700, 700, 0.02, 0.06) },
    // electronics
    "trace-and-solder": { tap: () => tone("square", 2700, 2700, 0.08, 0.05),       // continuity beep
                        go: () => { noise(0.12, 0.25, 0, "highpass", 4000); tone("sawtooth", 120, 60, 0.15, 0.1); }, // zap
                        tick: () => tone("square", 2700, 2700, 0.015, 0.03) },
    "first-circuit":  { tap: () => tone("sine", 1200, 1200, 0.06, 0.12),            // LED blip
                        go: () => { noise(0.012, 0.6, 0, "bandpass", 1500, 2); noise(0.012, 0.5, 0.05, "bandpass", 1300, 2); tone("sine", 1500, 1500, 0.12, 0.1, 0.06); }, // relay click
                        tick: () => tone("sine", 1000, 1000, 0.02, 0.05) },
    // engineering
    "tolerance":      { tap: () => noise(0.015, 0.6, 0, "bandpass", 2800, 6),       // caliper click
                        go: () => { [0, 0.045, 0.09, 0.135].forEach((a) => noise(0.012, 0.5, a, "bandpass", 3000, 6)); }, // ratchet
                        tick: () => noise(0.01, 0.4, 0, "bandpass", 3200, 8) },
    "layer-lines":    { tap: () => { tone("square", 400, 900, 0.1, 0.035); tone("square", 405, 905, 0.1, 0.03); }, // stepper whine
                        go: () => { tone("square", 300, 1200, 0.3, 0.035); tone("sine", 1200, 1200, 0.1, 0.1, 0.3); },
                        tick: () => tone("square", 600, 600, 0.02, 0.02) },
    // collecting
    "mint-condition": { tap: () => noise(0.06, 0.4, 0, "bandpass", 3000, 1, 1200),  // card flick
                        go: () => { [1760, 2217, 2637, 3520].forEach((f, i) => tone("sine", f, f, 0.3, 0.06, i * 0.05)); }, // holo shimmer
                        tick: () => noise(0.02, 0.25, 0, "bandpass", 3500, 2) },
    "shelf-life":     { tap: () => { bell(2093, 0.08, 0, 0.6); bell(2093, 0.03, 0.18, 0.5); }, // glass case tink with echo
                        go: () => { bell(1046, 0.12, 0, 1.4); bell(1568, 0.08, 0.12, 1.2); bell(1046, 0.04, 0.4, 1); },
                        tick: () => tone("sine", 2400, 2400, 0.03, 0.03) },
    // art
    "sketch-daily":   { tap: () => { for (let i = 0; i < 4; i++) noise(0.04, 0.25, i * 0.045, "bandpass", 3500 + i * 300, 2); }, // pencil scribble
                        go: () => { for (let i = 0; i < 7; i++) noise(0.05, 0.25, i * 0.04, "bandpass", 3000 + (i % 3) * 600, 2); },
                        tick: () => noise(0.03, 0.2, 0, "bandpass", 4000, 2) },
    "wet-paint":      { tap: () => noise(0.18, 0.3, 0, "lowpass", 2500, 0.8, 500),   // brush swish
                        go: () => { noise(0.2, 0.3, 0, "lowpass", 2500, 0.8, 500); tone("sine", 500, 1100, 0.12, 0.2, 0.15, { bend: 0.6 }); }, // swish + drip
                        tick: () => tone("sine", 700, 1100, 0.05, 0.08) },
    // music production
    "bedroom-beats":  { tap: () => hat(),
                        go: () => { kick(0); snare(0.12); },
                        tick: () => hat() },
    "vocal-booth":    { tap: () => tone("sine", 1000, 1000, 0.08, 0.1),           // broadcast beep
                        go: () => { noise(0.04, 0.6, 0, "lowpass", 300); tone("sine", 1000, 1000, 0.25, 0.1, 0.05); }, // mic pop + on-air tone
                        tick: () => tone("sine", 1000, 1000, 0.015, 0.04) },
    // music arts
    "six-strings":    { tap: () => pluck(329.63, 0.3, 0, 0.994, 0.9),             // high E
                        go: () => { [196, 246.94, 293.66, 392].forEach((f, i) => pluck(f, 0.22, i * 0.04)); }, // G chord strum
                        tick: () => pluck(659.25, 0.12, 0, 0.98, 0.3) },
    "mix-and-scratch": { tap: () => noise(0.12, 0.5, 0, "bandpass", 900, 2, 2600), // scratch forward
                        go: () => { noise(0.1, 0.5, 0, "bandpass", 800, 2, 2600); noise(0.1, 0.5, 0.11, "bandpass", 2600, 2, 700); kick(0.24, 0.6); }, // wiki-wiki + kick
                        tick: () => noise(0.03, 0.3, 0, "bandpass", 1500, 3) },
  };
  const S = T[theme] || T.hub;

  // ---------- wiring ----------
  const play = (k) => { if (on) try { S[k](); } catch (e) {} };
  document.addEventListener("click", (e) => {
    const el = e.target.closest("a, button, label, [role=button]");
    if (!el || el.id === "fc-mute" || el.closest("[data-nosfx]")) return;
    if (el.matches('a[rel~="sponsored"], .btn, .buy, .pad-btn')) play("go");
    else if (el.tagName === "A" && el.getAttribute("href") && el.getAttribute("href").startsWith("#")) play("tap");
    else if (el.tagName !== "A") play("tap");
  }, true);
  document.addEventListener("change", (e) => { if (e.target.matches('input[type=checkbox], input[type=radio], select')) play("tap"); }, true);
  let last = 0;
  document.addEventListener("input", (e) => {
    if (!e.target.matches("input[type=range], input[type=number]")) return;
    const now = performance.now(); if (now - last > 70) { last = now; play("tick"); }
  }, true);

  // ---------- mute button ----------
  const css = document.createElement("style");
  css.textContent = "#fc-mute{position:fixed;left:calc(14px + env(safe-area-inset-left,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:50;width:44px;height:44px;border-radius:50%;border:1px solid rgba(128,128,128,.35);background:rgba(20,20,24,.78);color:#fff;display:grid;place-items:center;cursor:pointer;backdrop-filter:blur(6px);box-shadow:0 6px 18px rgba(0,0,0,.25)}#fc-mute:focus-visible{outline:3px solid #ffb547;outline-offset:3px}#fc-mute svg{width:20px;height:20px}";
  document.head.appendChild(css);
  const btn = document.createElement("button");
  btn.id = "fc-mute";
  const icon = () => on
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>';
  const sync = () => { btn.innerHTML = icon(); btn.setAttribute("aria-label", on ? "Mute site sounds" : "Turn site sounds on"); btn.setAttribute("aria-pressed", String(!on)); };
  btn.addEventListener("click", () => { on = !on; try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) {} sync(); if (on) S.tap(); });
  sync();
  (document.body ? Promise.resolve() : new Promise((r) => addEventListener("DOMContentLoaded", r))).then(() => document.body.appendChild(btn));
})();
