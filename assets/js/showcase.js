/* ==========================================================================
   Projects section: filters, progress animation, counters, task toggles and
   the cursor spotlight. Progressive: with scripts off every card shows at its
   final state, because the "start empty" styles only apply under html.js.
   All motion is skipped when the visitor prefers reduced motion.
   ========================================================================== */
(function () {
  const section = document.getElementById('projects');
  if (!section) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards = Array.from(section.querySelectorAll('.sc-card'));
  const tagsOf = (card) => (card.dataset.tags || '').split(/\s+/);

  /* ---------- Progress bars: remember each bar's target width ---------- */
  for (const card of cards) {
    const bar = card.querySelector('.sc-bar i');
    if (bar) {
      bar.style.setProperty('--to', bar.style.width || '0%');
      const head = card.querySelector('.sc-meter-head');
      const pct = parseInt(bar.style.width, 10);
      if (head && !Number.isNaN(pct)) {
        const out = document.createElement('span');
        out.className = 'sc-pct';
        out.textContent = (reduce ? pct : 0) + '%';
        out.dataset.to = String(pct);
        head.querySelector('b')?.append(out);
      }
    }
    if (!reduce) card.setAttribute('data-animate', '');
  }

  /* ---------- Count a number up from 0 ---------- */
  function countUp(el, to, ms) {
    const start = performance.now();
    const fmt = (n) => n.toLocaleString('en-US');
    function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (el.dataset.suffix ? '' : '') + fmt(Math.round(to * eased)) + (el.dataset.suffix || '');
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Play a card when it scrolls into view ---------- */
  function play(card) {
    if (card.classList.contains('is-in')) return;
    card.classList.add('is-in');
    const bar = card.querySelector('.sc-bar');
    if (bar) {
      bar.classList.add('is-loading');
      setTimeout(() => bar.classList.remove('is-loading'), 1500);
    }
    const pct = card.querySelector('.sc-pct');
    if (pct) { pct.dataset.suffix = '%'; countUp(pct, Number(pct.dataset.to), 1300); }
    card.querySelectorAll('.sc-metrics b').forEach((b) => {
      const raw = b.textContent.trim();
      if (/^\d[\d,]*$/.test(raw)) countUp(b, Number(raw.replace(/,/g, '')), 900);
    });
    // Light up segments and tasks one after another.
    card.querySelectorAll('.sc-seg i').forEach((seg, i) => { seg.style.transitionDelay = (i * 120) + 'ms'; });
    card.querySelectorAll('.sc-tasks li').forEach((li, i) => { li.style.transitionDelay = (250 + i * 90) + 'ms'; });
  }

  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { play(e.target); io.unobserve(e.target); }
    }, { threshold: 0.25 });
    cards.forEach((c) => io.observe(c));
  } else {
    cards.forEach((c) => c.classList.add('is-in'));
  }

  /* ---------- Long task lists: show three, toggle the rest ---------- */
  for (const card of cards) {
    const list = card.querySelector('.sc-tasks');
    if (!list) continue;
    const items = Array.from(list.children);
    const keep = card.classList.contains('is-featured') ? 4 : 3;
    if (items.length <= keep) continue;
    items.slice(keep).forEach((li) => { li.classList.add('is-extra'); li.hidden = true; });
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sc-more';
    btn.setAttribute('aria-expanded', 'false');
    const label = () => (btn.getAttribute('aria-expanded') === 'true' ? 'Show fewer tasks' : `Show all ${items.length} tasks`);
    btn.textContent = label();
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      items.slice(keep).forEach((li) => { li.hidden = !open; });
      btn.textContent = label();
    });
    list.after(btn);
  }

  /* ---------- Cursor spotlight ---------- */
  if (!reduce) {
    section.addEventListener('pointermove', (e) => {
      const card = e.target.closest('.sc-card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  /* ---------- Filters (counts computed from the cards) ---------- */
  const bar = section.querySelector('.sc-filter');
  if (!bar) return;
  const buttons = Array.from(bar.querySelectorAll('button[data-filter]'));
  for (const btn of buttons) {
    const f = btn.dataset.filter;
    const n = f === 'all' ? cards.length : cards.filter((c) => tagsOf(c).includes(f)).length;
    const span = btn.querySelector('span');
    if (span) span.textContent = String(n);
    if (n === 0) btn.hidden = true;
  }

  function apply(filter) {
    for (const btn of buttons) btn.setAttribute('aria-pressed', String(btn.dataset.filter === filter));
    for (const card of cards) {
      const show = filter === 'all' || tagsOf(card).includes(filter);
      const was = !card.hidden;
      card.hidden = !show;
      if (show && !was && !reduce) {
        card.classList.remove('is-entering');
        void card.offsetWidth; // restart the entrance animation
        card.classList.add('is-entering');
        play(card);
      }
    }
    for (const grid of section.querySelectorAll('.sc-grid')) {
      const any = Array.from(grid.children).some((c) => !c.hidden);
      grid.hidden = !any;
      const head = grid.previousElementSibling;
      if (head && head.classList.contains('sc-subhead')) head.hidden = !any;
    }
  }

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (btn) apply(btn.dataset.filter);
  });
})();
