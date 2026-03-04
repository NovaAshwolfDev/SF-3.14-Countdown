  (() => {
    const VISIBLE = 3;
    const DAY_MS = 24 * 60 * 60 * 1000;
    let sets = [];
    let currentKeys = [];
    let tickTimer = null;
    let viewMode = null;

    const pad2 = n => String(n).padStart(2, "0");

    function waitTransition(el, ms = 560) {
      return new Promise(resolve => {
        let doneCalled = false;

        const done = (e) => {
          if (doneCalled) return;
          if (e && e.target !== el) return;
          doneCalled = true;
          el.removeEventListener("transitionend", done);
          resolve();
        };

        el.addEventListener("transitionend", done);
        setTimeout(() => done(), ms); // fallback
      });
    }

    async function tweenSwap(container, html) {
      const old = container.firstElementChild;

      if (old) {
        old.classList.add("tween");
        // ensure it starts at default (in case it was mid-state)
        old.classList.remove("tween-in-up", "tween-in-go");
        // trigger leave
        old.classList.add("tween-out-down");
        await waitTransition(old);
      }

      container.innerHTML = html;

      const fresh = container.firstElementChild;
      if (fresh) {
        fresh.classList.add("tween");
        fresh.classList.remove("tween-out-down");
        fresh.classList.add("tween-in-up");

        // 🔥 force layout so the browser commits the start state
        fresh.getBoundingClientRect();

        // now transition to final
        requestAnimationFrame(() => fresh.classList.add("tween-in-go"));
      }
    }
    
    function formatDays(ms) {
      ms = Math.max(0, Number(ms) || 0);
      const days = Math.ceil(ms / 86400000);
      return `${days} Day${days === 1 ? "" : "s"}`;
    }

    function formatMs(ms) {
      if (ms < 0) ms = 0;
      const total = Math.floor(ms / 1000);
      const d = Math.floor(total / 86400);
      const h = Math.floor((total % 86400) / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      return d > 0 ? `${d}d ${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
    }

    function getNextFuture(now) {
      const next = sets.find(s => now < s.startMs);
      if (!next) return null;
      return { next, diff: next.startMs - now };
    }

    function getAllSets(schedule) {
      const djList = Array.isArray(schedule)
        ? schedule
        : (Array.isArray(schedule?.djList) ? schedule.djList : []);

      return djList
        .filter(s => Number.isFinite(s.startTime) && Number.isFinite(s.length))
        .map(s => {
          const startMs = s.startTime * 1000;
          const endMs = startMs + (s.length * 60 * 1000);
          const key = `${s.startTime}-${s.name}`;
          return { ...s, startMs, endMs, key };
        })
        .sort((a, b) => a.startMs - b.startMs);
    }

    function shouldGate(now) {
      if (!sets.length) return false;

      const next = sets.find(s => now < s.startMs);
      if (!next) return false;

      const diff = next.startMs - now;

      console.log("[gate-next]", {
        now,
        nextName: next.name,
        nextStartMs: next.startMs,
        diff,
        diffHours: diff / 3600000,
        gate: diff > DAY_MS
      });

      shouldGate._next = next;
      shouldGate._diff = diff;

      return diff > 86400000;
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

    async function render(container) {
      const now = Date.now();
      const nextInfo = getNextFuture(now);

      let shouldShowGate = !!(nextInfo && nextInfo.diff > 86400000);
      const nextMode = shouldShowGate ? "gate" : "sets";

      if (nextMode === "gate") {
        const { diff } = nextInfo;

        const gateHTML = `
          <div class="setCard">
            <div class="setTopLine">
              <div class="startingIn">Stage Flight 3.14 starts in ${formatDays(diff)}.</div>
            </div>
          </div>
        `;

        if (viewMode !== "gate") {
          viewMode = "gate";
          currentKeys = [];
          await tweenSwap(container, gateHTML);
        } else {
          const el = container.querySelector(".startingIn");
          if (el) el.textContent = `Stage Flight 3.14 starts in ${formatDays(diff)}.`;
        }
        return;
      }

      const windowSets = pickWindow(now);
      const newKeys = windowSets.map(s => s.key);

      if (viewMode !== "sets") {
        viewMode = "sets";

        const temp = document.createElement("div");
        const frag = document.createDocumentFragment();
        for (let i = 0; i < windowSets.length; i++) frag.appendChild(buildCard(windowSets[i], i, now));
        temp.appendChild(frag);

        await tweenSwap(container, temp.innerHTML);
        currentKeys = newKeys;
        return;
      }

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
      await render(container);
      if (tickTimer) clearInterval(tickTimer);
      tickTimer = setInterval(() => { render(container).catch(console.error); }, 250);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => { boot().catch(console.error); }, { once: true });
    } else {
      boot().catch(console.error);
    }
  })();
