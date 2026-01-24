(() => {
  const VISIBLE = 3;
  let sets = [];
  let currentKeys = [];
  let tickTimer = null;

  const pad2 = n => String(n).padStart(2, "0");

  function formatMs(ms) {
    if (ms < 0) ms = 0;
    const total = Math.floor(ms / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return d > 0 ? `${d}d ${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  }

  function getAllSets(schedule) {
    const rounds = Object.values(schedule || {});
    const all = [];
    for (const round of rounds) {
      if (round?.djList?.length) all.push(...round.djList);
    }
    return all
      .filter(s => Number.isFinite(s.startTime) && Number.isFinite(s.length))
      .map(s => {
        const startMs = s.startTime * 1000;
        const endMs = startMs + (s.length * 60 * 1000);
        const key = `${s.startTime}-${s.name}`;
        return { ...s, startMs, endMs, key };
      })
      .sort((a, b) => a.startMs - b.startMs);
  }

  async function loadSchedule() {
    const res = await fetch("./schedule.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`schedule.json fetch failed: ${res.status}`);
    return res.json();
  }

  function classify(now, item) {
    if (now >= item.startMs && now < item.endMs) return "live";
    if (now < item.startMs) return "next";
    return "done";
  }

  function pickWindow(now) {
    if (!sets.length) return [];
    let idx = sets.findIndex(s => now < s.endMs);
    if (idx < 0) idx = sets.length - 1;
    const window = sets.slice(idx, idx + VISIBLE);
    return window;
  }

  function labelForIndex(i, now, item) {
    const state = classify(now, item);
    if (i === 0 && state === "live") return { text: "LIVE", cls: "live" };
    if (i === 0 && state === "next") return { text: "NEXT", cls: "next" };
    if (i === 1) return { text: "NEXT", cls: "next" };
    return { text: "LATER", cls: "later" };
  }

  function timeText(now, item) {
    if (now >= item.startMs && now < item.endMs) {
      return `Time left: ${formatMs(item.endMs - now)}`;
    }
    if (now < item.startMs) {
      return `Starts in: ${formatMs(item.startMs - now)}`;
    }
    return `Ended`;
  }

  function rangeText(item) {
    const start = new Date(item.startMs).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
    const end = new Date(item.endMs).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${start} → ${end} • ${item.length}m`;
  }

  function buildCard(item, index, now) {
    const card = document.createElement("div");
    card.className = "setCard";
    card.dataset.key = item.key;

    const badge = labelForIndex(index, now, item);

    const top = document.createElement("div");
    top.className = "setTopLine";

    if (Number.isInteger(item.logo) && item.logo >= 0) {
      const img = document.createElement("img");
      img.className = "setLogo";
      img.src = `./images/logos/${item.logo + 1}.png`;
      img.alt = item.name;
      img.loading = "lazy";
      img.onerror = () => img.remove();
      top.appendChild(img);
    }

    const textWrap = document.createElement("div");
    textWrap.className = "setTextWrap";

    const name = document.createElement("div");
    name.className = "setName";
    name.textContent = item.name;

    const meta = document.createElement("div");
    meta.className = "setMeta";
    meta.textContent = timeText(now, item);

    textWrap.appendChild(name);
    textWrap.appendChild(meta);
    top.appendChild(textWrap);

    const sub = document.createElement("div");
    sub.className = "setSub";

    const genre = item.genre ? item.genre : "";
    const dot = genre ? ` • ${genre}` : "";
    sub.innerHTML = `<span class="badge ${badge.cls}">${badge.text}</span>${rangeText(item)}${dot}`;

    card.appendChild(top);
    card.appendChild(sub);
    return card;
  }


  function updateCardText(card, item, index, now) {
    const nameEl = card.querySelector(".setName");
    const metaEl = card.querySelector(".setMeta");
    const subEl = card.querySelector(".setSub");
    if (nameEl) nameEl.textContent = item.name;
    if (metaEl) metaEl.textContent = timeText(now, item);
    if (subEl) {
      const badge = labelForIndex(index, now, item);
      const genre = item.genre ? item.genre : "";
      const dot = genre ? ` • ${genre}` : "";
      subEl.innerHTML = `<span class="badge ${badge.cls}">${badge.text}</span>${rangeText(item)}${dot}`;
    }
  }

  function rectMap(container) {
    const map = new Map();
    container.querySelectorAll(".setCard").forEach(el => {
      map.set(el.dataset.key, el.getBoundingClientRect());
    });
    return map;
  }

  function applyFLIP(container, before, after) {
    container.querySelectorAll(".setCard").forEach(el => {
      const key = el.dataset.key;
      const b = before.get(key);
      const a = after.get(key);
      if (!b || !a) return;
      const dx = b.left - a.left;
      const dy = b.top - a.top;
      if (!dx && !dy) return;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = "transform 0ms";
      requestAnimationFrame(() => {
        el.style.transition = "";
        el.style.transform = "";
      });
    });
  }

  function render(container) {
    const now = Date.now();
    const windowSets = pickWindow(now);
    const newKeys = windowSets.map(s => s.key);

    const before = rectMap(container);

    const existing = new Map();
    container.querySelectorAll(".setCard").forEach(el => existing.set(el.dataset.key, el));

    if (currentKeys.length && currentKeys[0] !== newKeys[0]) {
      const oldTop = existing.get(currentKeys[0]);
      if (oldTop) {
        oldTop.classList.add("exit");
        setTimeout(() => {
          if (oldTop.parentNode) oldTop.parentNode.removeChild(oldTop);
        }, 430);
      }
    }

    const frag = document.createDocumentFragment();
    for (let i = 0; i < windowSets.length; i++) {
      const item = windowSets[i];
      const prevEl = existing.get(item.key);
      if (prevEl) {
        updateCardText(prevEl, item, i, now);
        frag.appendChild(prevEl);
      } else {
        frag.appendChild(buildCard(item, i, now));
      }
    }

    container.innerHTML = "";
    container.appendChild(frag);

    const after = rectMap(container);
    applyFLIP(container, before, after);

    currentKeys = newKeys;
  }

  async function boot() {
    const container = document.getElementById("setList");
    if (!container) return;

    container.innerHTML = `<div class="setCard"><div class="setTopLine"><div class="setName">Loading…</div><div class="setMeta"></div></div><div class="setSub"></div></div>`;

    const schedule = await loadSchedule();
    sets = getAllSets(schedule);

    if (!sets.length) {
      container.innerHTML = `<div class="setCard"><div class="setTopLine"><div class="setName">No sets found</div><div class="setMeta"></div></div><div class="setSub"></div></div>`;
      return;
    }

    render(container);
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => render(container), 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { boot().catch(console.error); }, { once: true });
  } else {
    boot().catch(console.error);
  }
})();
