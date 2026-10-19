"use strict";

const ROUNDS = 10;
const QUESTION_MS = 15000;
const FEEDBACK_MS = 1100;

const app = document.getElementById("app");

// ---------- Narzędzia ----------

function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // brak pamięci przeglądarki — gra działa dalej, tylko bez historii
    }
  },
};

// ---------- Pytania ----------

// Te same (ziarno, region) zawsze dają te same pytania — na tym opiera się pojedynek przez link.
function buildQuestions(seed, region) {
  const rng = mulberry32(seed);
  const pool = COUNTRIES.map((_, i) => i).filter((i) => region === "all" || COUNTRIES[i][2] === region);
  return shuffle(pool, rng).slice(0, ROUNDS).map((i) => {
    const [country, capital, reg] = COUNTRIES[i];
    const wrong = shuffle(
      COUNTRIES.filter((c) => c[2] === reg && c[1] !== capital).map((c) => c[1]),
      rng
    ).slice(0, 3);
    return { country, capital, options: shuffle([capital, ...wrong], rng) };
  });
}

// ---------- Linki z wyzwaniem ----------

function encodeDuel(duel) {
  const bytes = new TextEncoder().encode(JSON.stringify(duel));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeDuel(text) {
  try {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const duel = JSON.parse(new TextDecoder().decode(bytes));
    const valid =
      Number.isInteger(duel.s) &&
      typeof duel.r === "string" && duel.r in REGIONS &&
      Array.isArray(duel.p) && duel.p.length >= 1 && duel.p.length <= 2 &&
      duel.p.every((p) => typeof p.n === "string" && Array.isArray(p.k) && p.k.length === ROUNDS &&
        p.k.every((x) => Number.isInteger(x) && x >= 0 && x <= 250));
    return valid ? duel : null;
  } catch {
    return null;
  }
}

function duelLink(duel) {
  return location.origin + location.pathname + "#w=" + encodeDuel(duel);
}

async function shareLink(url, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title: "Mozambik — pojedynek na stolice", text, url });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(text + " " + url);
    return "copied";
  } catch {
    window.prompt("Skopiuj link i wyślij go znajomemu:", url);
    return "shown";
  }
}

const total = (k) => k.reduce((a, b) => a + b, 0);
const correctCount = (k) => k.filter((x) => x > 0).length;

// ---------- Historia pojedynków ----------

function duelKey(duel) {
  return duel.s + ":" + duel.r;
}

function saveDuel(duel) {
  const all = store.get("duels", {});
  const key = duelKey(duel);
  const prev = all[key];
  // Nie nadpisuj pełnego wyniku wersją z jednym graczem.
  if (prev && prev.p.length > duel.p.length) return;
  all[key] = { ...duel, at: Date.now() };
  store.set("duels", all);
}

function findDuel(duel) {
  return store.get("duels", {})[duelKey(duel)] || null;
}

// ---------- Ekrany ----------

function playerName() {
  return store.get("name", "");
}

function regionSelect(id) {
  const current = store.get("region", "all");
  return `<select id="${id}">${Object.entries(REGIONS)
    .map(([k, v]) => `<option value="${k}"${k === current ? " selected" : ""}>${esc(v)}</option>`)
    .join("")}</select>`;
}

function readNameInput() {
  const input = document.getElementById("name");
  const name = input.value.trim().slice(0, 20);
  if (!name) {
    input.focus();
    input.classList.add("shake");
    setTimeout(() => input.classList.remove("shake"), 400);
    return null;
  }
  store.set("name", name);
  return name;
}

function showHome() {
  history.replaceState(null, "", location.pathname);
  const duels = Object.values(store.get("duels", {})).sort((a, b) => b.at - a.at).slice(0, 8);
  app.innerHTML = `
    <section class="screen home">
      <header class="brand">
        <div class="globe" aria-hidden="true">🌍</div>
        <h1>Mozambik</h1>
        <p class="sub">Pojedynek na stolice państw świata</p>
      </header>
      <label class="field">
        <span>Twoje imię</span>
        <input id="name" maxlength="20" autocomplete="nickname" placeholder="np. Ania" value="${esc(playerName())}">
      </label>
      <label class="field">
        <span>Kontynent</span>
        ${regionSelect("region")}
      </label>
      <div class="actions">
        <button class="btn primary" id="challenge">⚔️ Wyzwij kolegę</button>
        <button class="btn" id="practice">🎯 Trening</button>
      </div>
      ${duels.length ? `
        <h2>Twoje pojedynki</h2>
        <ul class="duels">${duels.map(duelRow).join("")}</ul>` : ""}
      <p class="hint">${ROUNDS} pytań, ${QUESTION_MS / 1000} sekund na każde. Im szybciej odpowiesz, tym więcej punktów.</p>
    </section>`;

  document.getElementById("region").onchange = (e) => store.set("region", e.target.value);
  document.getElementById("practice").onclick = () => {
    const name = readNameInput();
    if (name) startGame({ mode: "practice", seed: newSeed(), region: store.get("region", "all"), name });
  };
  document.getElementById("challenge").onclick = () => {
    const name = readNameInput();
    if (name) startGame({ mode: "challenge", seed: newSeed(), region: store.get("region", "all"), name });
  };
  app.querySelectorAll("[data-duel]").forEach((el) => {
    el.onclick = () => openDuel(store.get("duels", {})[el.dataset.duel]);
  });
}

function duelRow(duel) {
  const [a, b] = duel.p;
  const status = b
    ? `${total(a.k)} : ${total(b.k)}`
    : `<span class="waiting">czeka na rywala</span>`;
  return `<li><button data-duel="${esc(duelKey(duel))}">
    <span>${esc(a.n)} vs ${b ? esc(b.n) : "?"}</span><span class="muted">${esc(REGIONS[duel.r])}</span>
    <strong>${status}</strong></button></li>`;
}

function showChallengeIntro(duel) {
  const from = duel.p[0];
  app.innerHTML = `
    <section class="screen intro">
      <div class="globe" aria-hidden="true">⚔️</div>
      <h1>${esc(from.n)} wyzywa cię!</h1>
      <p class="sub">${ROUNDS} pytań · ${esc(REGIONS[duel.r])}<br>Wynik rywala zobaczysz po swojej grze.</p>
      <label class="field">
        <span>Twoje imię</span>
        <input id="name" maxlength="20" autocomplete="nickname" placeholder="np. Kuba" value="${esc(playerName())}">
      </label>
      <div class="actions">
        <button class="btn primary" id="go">Przyjmuję wyzwanie</button>
        <button class="btn ghost" id="home">Nie teraz</button>
      </div>
    </section>`;
  document.getElementById("go").onclick = () => {
    const name = readNameInput();
    if (name) startGame({ mode: "answer", seed: duel.s, region: duel.r, name, duel });
  };
  document.getElementById("home").onclick = showHome;
}

// ---------- Rozgrywka ----------

function startGame(opts) {
  const questions = buildQuestions(opts.seed, opts.region);
  const state = { ...opts, questions, index: 0, points: [], picks: [] };
  history.replaceState(null, "", location.pathname);
  showQuestion(state);
}

function showQuestion(state) {
  const q = state.questions[state.index];
  const score = total(state.points);
  app.innerHTML = `
    <section class="screen game">
      <div class="topbar">
        <span>Pytanie <strong>${state.index + 1}</strong>/${state.questions.length}</span>
        <span class="score">${score} pkt</span>
      </div>
      <div class="timer"><div class="timer-fill" id="timer"></div></div>
      <div class="question">
        <p class="label">Jaka jest stolica państwa</p>
        <h1 class="country">${esc(q.country)}?</h1>
      </div>
      <div class="options">
        ${q.options.map((o, i) => `<button class="option" data-i="${i}">${esc(o)}</button>`).join("")}
      </div>
      <p class="gain" id="gain" aria-live="polite"></p>
    </section>`;

  const fill = document.getElementById("timer");
  const buttons = [...app.querySelectorAll(".option")];
  const started = performance.now();
  let done = false;
  let frame;

  const tick = () => {
    const left = Math.max(0, QUESTION_MS - (performance.now() - started));
    fill.style.transform = `scaleX(${left / QUESTION_MS})`;
    fill.classList.toggle("low", left < 4000);
    if (left <= 0) finish(-1);
    else frame = requestAnimationFrame(tick);
  };

  const finish = (pick) => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    const left = Math.max(0, QUESTION_MS - (performance.now() - started));
    const right = pick >= 0 && q.options[pick] === q.capital;
    const gained = right ? 100 + Math.round((left / QUESTION_MS) * 150) : 0;
    state.points.push(gained);
    state.picks.push(pick >= 0 ? q.options[pick] : null);

    buttons.forEach((b, i) => {
      b.disabled = true;
      if (q.options[i] === q.capital) b.classList.add("right");
      else if (i === pick) b.classList.add("wrong");
    });
    const gain = document.getElementById("gain");
    gain.textContent = right ? `+${gained} pkt` : pick < 0 ? `Czas minął! To ${q.capital}.` : `Niestety, to ${q.capital}.`;
    gain.className = "gain " + (right ? "good" : "bad");
    if (navigator.vibrate && !right) navigator.vibrate(120);

    setTimeout(() => {
      state.index++;
      if (state.index < state.questions.length) showQuestion(state);
      else endGame(state);
    }, FEEDBACK_MS);
  };

  buttons.forEach((b) => (b.onclick = () => finish(Number(b.dataset.i))));
  frame = requestAnimationFrame(tick);
}

function endGame(state) {
  const me = { n: state.name, k: state.points };
  if (state.mode === "practice") return showPracticeResult(state);
  const duel =
    state.mode === "challenge"
      ? { v: DATA_VERSION, s: state.seed, r: state.region, p: [me] }
      : { ...state.duel, p: [state.duel.p[0], me] };
  delete duel.at;
  saveDuel(duel);
  showDuel(duel, state);
}

function answersList(state) {
  return `<ol class="answers">${state.questions.map((q, i) => {
    const ok = state.points[i] > 0;
    return `<li class="${ok ? "ok" : "ko"}"><span>${esc(q.country)}</span>
      <span>${ok ? "" : `<s>${esc(state.picks[i] || "—")}</s> `}<strong>${esc(q.capital)}</strong></span></li>`;
  }).join("")}</ol>`;
}

function showPracticeResult(state) {
  app.innerHTML = `
    <section class="screen result">
      <p class="label">Trening zakończony</p>
      <div class="big">${total(state.points)} <small>pkt</small></div>
      <p class="sub">${correctCount(state.points)} z ${state.questions.length} poprawnych</p>
      <div class="actions">
        <button class="btn primary" id="again">Zagraj jeszcze raz</button>
        <button class="btn ghost" id="home">Menu</button>
      </div>
      ${answersList(state)}
    </section>`;
  document.getElementById("again").onclick = () =>
    startGame({ ...state, seed: newSeed() });
  document.getElementById("home").onclick = showHome;
}

// Widok pojedynku: czekanie na rywala albo porównanie wyników.
function showDuel(duel, state) {
  const [a, b] = duel.p;
  const me = playerName();
  let body;

  if (!b) {
    body = `
      <p class="label">Twój wynik</p>
      <div class="big">${total(a.k)} <small>pkt</small></div>
      <p class="sub">${correctCount(a.k)} z ${ROUNDS} poprawnych</p>
      <div class="card">
        <strong>Teraz kolej rywala.</strong>
        Wyślij mu link — dostanie te same pytania, a twój wynik zobaczy dopiero po swojej grze.
      </div>
      <div class="actions">
        <button class="btn primary" id="share">📤 Wyślij wyzwanie</button>
        <button class="btn ghost" id="home">Menu</button>
      </div>
      <p class="hint" id="shared" aria-live="polite"></p>`;
  } else {
    const ta = total(a.k), tb = total(b.k);
    const verdict = ta === tb ? "Remis!" : `Wygrywa ${esc(ta > tb ? a.n : b.n)}! 🏆`;
    const iAmB = state && state.mode === "answer";
    body = `
      <p class="label">${esc(REGIONS[duel.r])}</p>
      <h1 class="verdict">${verdict}</h1>
      <div class="versus">
        ${playerCard(a, ta >= tb)}
        <span class="vs">vs</span>
        ${playerCard(b, tb >= ta)}
      </div>
      <ol class="rounds">${buildQuestions(duel.s, duel.r).map((q, i) => `
        <li><span class="${a.k[i] ? "ok" : "ko"}">${a.k[i] || "✗"}</span>
        <span class="q"><b>${esc(q.country)}</b><small>${esc(q.capital)}</small></span>
        <span class="${b.k[i] ? "ok" : "ko"}">${b.k[i] || "✗"}</span></li>`).join("")}
      </ol>
      <div class="actions">
        ${iAmB ? `<button class="btn primary" id="share">📤 Odeślij wynik rywalowi</button>` : ""}
        <button class="btn${iAmB ? "" : " primary"}" id="rematch">⚔️ Rewanż</button>
        <button class="btn ghost" id="home">Menu</button>
      </div>
      <p class="hint" id="shared" aria-live="polite"></p>`;
  }

  app.innerHTML = `<section class="screen result">${body}</section>`;

  const share = document.getElementById("share");
  if (share) {
    share.onclick = async () => {
      const text = b
        ? `${b.n}: ${total(b.k)} pkt, ${a.n}: ${total(a.k)} pkt. Zobacz wynik pojedynku na stolice!`
        : `${a.n} zdobył(a) ${total(a.k)} pkt w quizie ze stolic. Dasz radę więcej?`;
      const res = await shareLink(duelLink(duel), text);
      const msg = { copied: "Link skopiowany — wklej go w wiadomości.", shared: "Wysłano!" }[res];
      if (msg) document.getElementById("shared").textContent = msg;
    };
  }
  const rematch = document.getElementById("rematch");
  if (rematch) {
    rematch.onclick = () => {
      if (!me) return showHome();
      startGame({ mode: "challenge", seed: newSeed(), region: duel.r, name: me });
    };
  }
  document.getElementById("home").onclick = showHome;
}

function playerCard(p, lead) {
  return `<div class="player${lead ? " lead" : ""}">
    <span class="name">${esc(p.n)}</span>
    <span class="pts">${total(p.k)}</span>
    <span class="muted">${correctCount(p.k)}/${ROUNDS}</span></div>`;
}

// Otwarcie pojedynku z linku albo z historii.
function openDuel(duel) {
  const known = findDuel(duel);
  if (duel.p.length === 1 && known) {
    // Już w tym pojedynku grałeś — pokaż swój stan zamiast grać ponownie.
    return showDuel(known);
  }
  if (duel.p.length === 1) return showChallengeIntro(duel);
  saveDuel(duel);
  showDuel(duel);
}

function route() {
  const match = location.hash.match(/^#w=([\w-]+)/);
  if (!match) return showHome();
  const duel = decodeDuel(match[1]);
  if (!duel) {
    showHome();
    return;
  }
  if (duel.v !== DATA_VERSION) {
    app.innerHTML = `<section class="screen intro"><h1>Ten link pochodzi z innej wersji gry</h1>
      <p class="sub">Poproś znajomego o nowe wyzwanie.</p>
      <div class="actions"><button class="btn primary" id="home">Menu</button></div></section>`;
    document.getElementById("home").onclick = showHome;
    return;
  }
  openDuel(duel);
}

window.addEventListener("hashchange", route);
route();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
}
