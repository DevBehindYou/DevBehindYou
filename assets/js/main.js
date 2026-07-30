/* ==========================================================================
   DevBehindYou — page interactions
   Motion runtime: Framer Motion's vanilla DOM build, vendored locally at
   assets/js/vendor/motion.min.js so this stays a no-build static site.

   That bundle is `npm i framer-motion` tree-shaken down to the five things
   this page needs (animate / inView / scroll / stagger / spring) — 28KB raw,
   ~11KB over the wire. The React `framer-motion` entry point is not usable
   here: it renders through React components, and the brief was plain HTML,
   CSS and JavaScript. Same library, same spring model, no framework.

   To rebuild the bundle after upgrading:
     npm i framer-motion
     echo 'export { animate } from "framer-motion/dom/mini";
           export { scroll, inView, stagger, spring } from "framer-motion/dom";' > entry.mjs
     npx esbuild entry.mjs --bundle --format=esm --minify \
       --outfile=assets/js/vendor/motion.min.js

   Everything here is progressive enhancement. If this module fails to load
   or the import 404s, the page is still complete and readable: content is
   real HTML, reveals stay visible, and the work carousel renders as a grid.
   ========================================================================== */

import { animate, inView, scroll, stagger } from './vendor/motion.min.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const EASE = [0.16, 1, 0.3, 1];
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

/* --------------------------------------------------------------------------
   Footer year
   -------------------------------------------------------------------------- */
const yearEl = $('#year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

/* --------------------------------------------------------------------------
   Section reveals
   [data-reveal]        fades the block in once, on first entry
   [data-stagger]       staggers that block's direct children instead
   -------------------------------------------------------------------------- */
$$('[data-reveal]').forEach((el) => {
  if (reduced) { el.classList.add('is-in'); return; }

  // `amount` is a fraction of the TARGET, not the viewport, so a fixed 0.15 can
  // never be satisfied by an element more than ~6.6 screens tall — it would sit
  // at opacity 0 forever. Sections that outgrow the viewport get "some" instead.
  const amount = el.getBoundingClientRect().height > window.innerHeight ? 'some' : 0.15;

  inView(el, () => {
    const targets = el.hasAttribute('data-stagger')
      ? Array.from(el.children)
      : [el];

    // The parent is opacity:0 via CSS until .is-in lands. For staggered
    // blocks the parent must become visible first, then children animate in.
    if (el.hasAttribute('data-stagger')) {
      el.classList.add('is-in');
      animate(
        targets,
        { opacity: [0, 1], transform: ['translateY(22px)', 'none'] },
        { duration: 0.5, delay: stagger(0.07), ease: EASE }
      );
    } else {
      animate(
        el,
        { opacity: [0, 1], transform: ['translateY(22px)', 'none'] },
        { duration: 0.6, ease: EASE }
      ).finished.finally(() => el.classList.add('is-in'));
    }
  }, { amount });
});

/* --------------------------------------------------------------------------
   Nav — condensed state on scroll + scrollspy + mobile menu
   -------------------------------------------------------------------------- */
const nav = $('#nav');
if (nav) {
  scroll((_progress, info) => {
    const y = info?.y?.current ?? window.scrollY;
    nav.classList.toggle('is-scrolled', y > 24);
  });
}

const navLinks = $$('.nav-links a');
navLinks.forEach((link) => {
  const target = document.getElementById(link.hash.slice(1));
  if (!target) return;
  inView(target, () => {
    navLinks.forEach((l) => l.removeAttribute('aria-current'));
    link.setAttribute('aria-current', 'true');
    return () => link.removeAttribute('aria-current');
  }, { amount: 0.25 });
});

const toggle = $('.nav-toggle');
const menu = $('#mobile-menu');
if (toggle && menu) {
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    if (open && !reduced) {
      animate(menu, { opacity: [0, 1], transform: ['translateY(-8px)', 'none'] },
              { duration: 0.22, ease: EASE });
    }
  };

  toggle.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); toggle.focus(); } });
  // A resize past the desktop breakpoint leaves the panel orphaned otherwise.
  matchMedia('(min-width: 900px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

/* --------------------------------------------------------------------------
   Discipline tabs
   Full APG tablist keyboard support: arrows move, Home/End jump, and the
   roving tabindex keeps exactly one tab in the tab order. Panels start
   correct in the HTML, so this only handles switching.
   -------------------------------------------------------------------------- */
const tablist = $('.tablist');
if (tablist) {
  const tabs = $$('[role="tab"]', tablist);
  const panelOf = (tab) => document.getElementById(tab.getAttribute('aria-controls'));

  function select(tab, focus = true) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panelOf(t).hidden = !on;
    });
    if (focus) tab.focus();
    if (!reduced) {
      const panel = panelOf(tab);
      animate(panel, { opacity: [0, 1], transform: ['translateY(8px)', 'none'] },
              { duration: 0.3, ease: EASE });
      animate($$('.panel-list li', panel), { opacity: [0, 1], transform: ['translateX(-6px)', 'none'] },
              { duration: 0.28, delay: stagger(0.04), ease: EASE });
    }
  }

  tabs.forEach((tab) => tab.addEventListener('click', () => select(tab, false)));

  tablist.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const last = tabs.length - 1;
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(tabs[(next + tabs.length) % tabs.length]);
  });
}

/* --------------------------------------------------------------------------
   Spotlight glow on cards
   One document-level pointer listener writes the viewport cursor position
   into CSS custom properties. Because the gradient uses
   background-attachment: fixed, every card samples the same viewport-space
   origin, so the highlight tracks the real cursor across the whole grid
   instead of each card lighting its own centre.
   -------------------------------------------------------------------------- */
if (fine && !reduced) {
  const glow = $$('[data-glow]');
  if (glow.length) {
    let raf = 0, px = 0, py = 0;
    const paint = () => {
      raf = 0;
      for (const el of glow) {
        el.style.setProperty('--x', px.toFixed(1));
        el.style.setProperty('--y', py.toFixed(1));
      }
    };
    document.addEventListener('pointermove', (e) => {
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    }, { passive: true });
  }
}

/* --------------------------------------------------------------------------
   Hero eyebrow — rotating word
   Deliberately not applied to the H1: that headline is crafted copy, and
   cycling words through it would undercut it.
   -------------------------------------------------------------------------- */
const slot = $('#scan-slot');
if (slot) {
  const words = ['WEB BUILDS', 'APP BUILDS', 'SEO AUDITS', 'GEO STRATEGY', 'AI-SEO CONTENT'];
  const spans = words.map((w, i) => {
    const s = document.createElement('span');
    s.textContent = w;
    s.style.transform = i === 0 ? 'none' : 'translateY(110%)';
    s.style.opacity = i === 0 ? '1' : '0';
    slot.appendChild(s);
    return s;
  });

  if (!reduced) {
    let i = 0;
    setInterval(() => {
      const out = spans[i];
      i = (i + 1) % spans.length;
      const next = spans[i];
      animate(out, { transform: 'translateY(-110%)', opacity: 0 }, { duration: 0.45, ease: EASE });
      animate(next, { transform: ['translateY(110%)', 'none'], opacity: [0, 1] }, { duration: 0.45, ease: EASE });
    }, 2600);
  }
}

/* ==========================================================================
   THE CONSOLE
   A real command line in the hero. Two destinations matter more than any
   other link on this page — the full portfolio and the project request form —
   so both are first-class commands, and both are reachable by chip for anyone
   who is not going to type on a phone.

   The boot readout already exists as static HTML. Nothing here is required
   to read the page; this only adds the interaction on top.
   ========================================================================== */
const PORTFOLIO = 'https://devbehindyou.vercel.app/';
const REQUEST = 'https://devbehindyou-app-github.netlify.app/';

const consoleEl = $('#console');
if (consoleEl) {
  const out = $('#console-out');
  const form = $('#console-form');
  const input = $('#console-input');

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const kv = (k, v) => `<li class="ln-kv"><span>${k}</span><b>${v}</b></li>`;
  const link = (href, label) =>
    `<a href="${href}" target="_blank" rel="noopener">${label} ↗</a>`;

  const COMMANDS = {
    help: () => [
      '<li>Available commands:</li>',
      kv('whoami', 'who is behind this'),
      kv('builds', 'sites and apps shipped'),
      kv('skills', 'the working stack'),
      kv('proof', 'real client numbers'),
      kv('geo', 'what GEO actually means'),
      kv('portfolio', 'open the full site'),
      kv('hire', 'start a project request'),
      kv('contact', 'email address'),
      kv('clear', 'wipe the console'),
    ],

    whoami: () => [
      '<li>Ashutosh Sharma. Also known as DevBehindYou.</li>',
      '<li>Developer first. SEO/GEO specialist second. Data analyst by habit.</li>',
      '<li class="ln-hint">Web Developer and SEO Specialist at NinePages &middot; Growth Specialist at TheFirstRanker, part-time since Feb 2026 &middot; ran the Growth Team at Content Whale.</li>',
      '<li class="ln-hint">Freelance: web development, app development, SEO/GEO strategy, brand building, AI-SEO content.</li>',
    ],

    skills: () => [
      kv('build', 'React &middot; Next.js &middot; Node.js &middot; Mongo/Supabase/Firebase'),
      kv('seo/geo', 'Screaming Frog &middot; SEMrush &middot; Ahrefs &middot; schema &middot; pSEO'),
      kv('data', 'GA4 &middot; Search Console &middot; Python &middot; BigQuery'),
      kv('reporting', 'Tableau &middot; Power BI'),
      `<li class="ln-hint">Breakdown per discipline: ${link(PORTFOLIO + 'what-i-do/seo-geo', 'what-i-do')}</li>`,
    ],

    proof: () => [
      kv('web builds', '12+ shipped, client and personal'),
      kv('best lift', '700% organic traffic, Jidoka, 6 months'),
      kv('content shipped', '2,500+ pieces'),
      kv('strategies', '150+ SEO and GEO'),
      kv('wireframes', '250+ delivered'),
      `<li class="ln-hint">Every figure traces to a deliverable or a GA4 property. Full write-ups: ${link(PORTFOLIO + 'case-studies', 'case studies')}</li>`,
    ],

    builds: () => [
      kv('datastride.ai', 'Data and AI consultancy, site plus SEO/GEO strategy'),
      kv('The Hope Tarot', 'Full-stack Next.js, chat widget and custom CRM'),
      kv('Raku-Chan', 'Full-stack Next.js fan site with admin panel'),
      kv('templates', '14 site and app templates sold as source code'),
      `<li class="ln-hint">12+ DevBehindYou builds total. React, Next.js, Node, WordPress and Flutter, depending on what the project needed.</li>`,
    ],

    geo: () => [
      '<li>GEO = Generative Engine Optimization.</li>',
      '<li>Getting your brand surfaced and cited inside AI answers on ChatGPT, Perplexity and Google AI Overviews, not only in blue links.</li>',
      '<li class="ln-hint">Answer engines pull from structured, verifiable, entity-rich content. So the work is schema, entity signals, direct answer formatting and crawler config.</li>',
    ],

    contact: () => [
      kv('email', '<a href="mailto:devbehindyou@gmail.com">devbehindyou@gmail.com</a>'),
      kv('reply time', '1 business day'),
      `<li class="ln-hint">Faster route: type <code>hire</code> for the request form.</li>`,
    ],

    portfolio: () => ({
      open: PORTFOLIO,
      lines: [
        '<li>Opening the full portfolio. Case studies, results, services, and 14 templates.</li>',
        `<li class="ln-hint">If the tab did not open: ${link(PORTFOLIO, 'devbehindyou.vercel.app')}</li>`,
      ],
    }),

    hire: () => ({
      open: REQUEST,
      lines: [
        '<li>Opening the project request form. Three fields: email, phone, and what you are building.</li>',
        `<li class="ln-hint">If the tab did not open: ${link(REQUEST, 'start a request')}</li>`,
      ],
    }),
  };

  // Aliases, so the obvious synonym never dead-ends in "command not found".
  const ALIAS = {
    stack: 'skills', tech: 'skills', ls: 'help', '?': 'help', man: 'help',
    about: 'whoami', me: 'whoami', bio: 'whoami',
    work: 'portfolio', site: 'portfolio', open: 'portfolio',
    projects: 'builds', sites: 'builds', apps: 'builds', dev: 'builds',
    request: 'hire', quote: 'hire', contactform: 'hire',
    results: 'proof', stats: 'proof', cases: 'proof',
    email: 'contact', mail: 'contact',
  };
  const NAMES = Object.keys(COMMANDS);

  const scrollOut = () => { out.scrollTop = out.scrollHeight; };

  function print(html, cls) {
    const li = document.createElement('li');
    if (cls) li.className = cls;
    li.innerHTML = html;
    out.appendChild(li);
    return li;
  }

  function printLines(lines) {
    const added = lines.map((h) => {
      const tpl = document.createElement('template');
      tpl.innerHTML = h.trim();
      const node = tpl.content.firstElementChild;
      out.appendChild(node);
      return node;
    });
    if (!reduced) {
      animate(added, { opacity: [0, 1], transform: ['translateY(6px)', 'none'] },
              { duration: 0.28, delay: stagger(0.05), ease: EASE });
    }
    scrollOut();
  }

  function run(raw) {
    const cmd = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!cmd) return;

    print(`<span class="ln-p">$</span>${esc(raw.trim())}`, 'ln-cmd');

    if (cmd === 'clear') {
      out.replaceChildren();
      print('Console cleared. Type <code>help</code> to start again.', 'ln-hint');
      return;
    }

    // "open portfolio" and "portfolio" should both work.
    const head = cmd.split(' ')[0];
    const tail = cmd.split(' ')[1];
    const key = COMMANDS[cmd] ? cmd
      : COMMANDS[ALIAS[cmd]] ? ALIAS[cmd]
      : (head === 'open' || head === 'go') && (COMMANDS[tail] || COMMANDS[ALIAS[tail]])
        ? (COMMANDS[tail] ? tail : ALIAS[tail])
        : COMMANDS[head] ? head
        : COMMANDS[ALIAS[head]] ? ALIAS[head]
        : null;

    if (!key) {
      printLines([
        `<li class="ln-err">command not found: ${esc(raw.trim())}</li>`,
        `<li class="ln-hint">Try <code>help</code>, or jump straight to <code>portfolio</code> / <code>hire</code>.</li>`,
      ]);
      return;
    }

    const result = COMMANDS[key]();
    if (Array.isArray(result)) { printLines(result); return; }

    printLines(result.lines);
    // window.open only survives the popup blocker inside a trusted event, which
    // is exactly where this runs. The printed link is the fallback if it does not.
    if (result.open) window.open(result.open, '_blank', 'noopener');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    if (value.trim()) { cmdHistory.push(value.trim()); hIdx = cmdHistory.length; }
    run(value);
  });

  // History recall and tab completion — small touches, but their absence is
  // exactly what makes a fake terminal feel fake. Named cmdHistory rather than
  // history so it does not shadow window.history inside this block.
  const cmdHistory = [];
  let hIdx = 0;

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIdx > 0) { hIdx--; input.value = cmdHistory[hIdx]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hIdx < cmdHistory.length - 1) { hIdx++; input.value = cmdHistory[hIdx]; }
      else { hIdx = cmdHistory.length; input.value = ''; }
    } else if (e.key === 'Tab') {
      const partial = input.value.trim().toLowerCase();
      if (!partial) return;
      const hit = NAMES.find((n) => n.startsWith(partial))
        || Object.keys(ALIAS).find((a) => a.startsWith(partial));
      if (hit) { e.preventDefault(); input.value = hit; }
    }
  });

  $$('.console-chips button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      cmdHistory.push(cmd);
      hIdx = cmdHistory.length;
      run(cmd);
      // Focus only on pointer devices — pulling up the keyboard on a phone
      // right after a tap scrolls the console out from under the reader.
      if (fine) input.focus();
    });
  });

  // Clicking anywhere in the output area focuses the prompt, like a real terminal.
  out.addEventListener('click', (e) => { if (fine && !e.target.closest('a')) input.focus(); });

  // Boot: replay the static readout as if it were just produced. No content is
  // created here — these lines are already in the HTML.
  if (!reduced) {
    const seeded = Array.from(out.children);
    animate(seeded, { opacity: [0, 1], transform: ['translateY(6px)', 'none'] },
            { duration: 0.3, delay: stagger(0.07, { startDelay: 0.25 }), ease: EASE });
  }
}

/* --------------------------------------------------------------------------
   The Builder — scroll-tied 3D reveal on the portrait plate
   -------------------------------------------------------------------------- */
const builder = $('#builder-frame');
if (builder && !reduced) {
  scroll((p) => {
    builder.style.transform = `rotateX(${(1 - p) * 12}deg) scale(${0.93 + p * 0.07})`;
  }, { target: builder, offset: ['start end', 'center center'] });
}

/* --------------------------------------------------------------------------
   Stat count-up — animates the number, keeps the printed value as the
   fallback so the real figure is in the HTML for crawlers either way.
   -------------------------------------------------------------------------- */
$$('[data-count]').forEach((el) => {
  const end = Number(el.dataset.count);
  if (!Number.isFinite(end) || reduced) return;
  const suffix = el.dataset.suffix ?? '';

  inView(el, () => {
    const start = performance.now();
    const dur = 1100;
    const tick = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      /* Grouped so 1100 counts up as "1,100+" and matches the static HTML
         fallback rather than snapping to an ungrouped number at the end. */
      el.textContent = Math.round(end * eased).toLocaleString('en-US') + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { amount: 0.6 });
});

/* --------------------------------------------------------------------------
   Featured Work — draggable stacked case files
   The four cards are real static HTML (see index.html). This only layers
   stack positioning on top, so the content is crawlable and screen-reader
   readable before any of this runs. Prev/next buttons are the keyboard path,
   since dragging alone is not reachable without a pointer.
   -------------------------------------------------------------------------- */
const stage = $('#work-stage');
if (stage && !reduced) {
  const cards = $$('.work-card', stage);
  const total = cards.length;
  const drag = $('#work-drag');
  const nav2 = $('#work-nav');
  const counter = $('#work-count');

  stage.classList.remove('is-static');
  if (nav2) nav2.hidden = false;

  const cfg = () => (innerWidth < 640
    ? { x: 88, y: 18, rot: 7, drop: 0.08, sens: 170 }
    : { x: 150, y: 26, rot: 9, drop: 0.1, sens: 220 });

  let c = cfg();
  addEventListener('resize', () => { c = cfg(); render(); }, { passive: true });

  // `progress` is the animated position; `index` is the committed target card.
  // They have to be separate: stepping off Math.round(progress) mid-tween lets
  // fast repeated clicks read a half-way value and cancel each other out.
  let progress = 0;
  let index = 0;

  function render() {
    cards.forEach((el, i) => {
      const off = i - progress;
      const abs = Math.abs(off);
      const rot = abs < 0.04 ? 0 : off * c.rot;
      const lift = abs < 0.04 ? 0 : abs * c.y;
      const scale = Math.max(0.72, 1 - abs * c.drop);
      el.style.transform =
        `translate(-50%,-50%) translate(${off * c.x}px, ${lift}px) rotate(${rot}deg) scale(${scale})`;
      el.style.zIndex = String(Math.round(100 - abs * 10));
      el.style.opacity = String(Math.max(0.12, 1 - abs * 0.32));
      // pointer-events only — deliberately NOT aria-hidden or inert. All four
      // projects stay in the tab order; tabbing to a card behind the stack
      // fires the focusin handler below, which brings it to the front.
      // aria-hidden over a focusable link is a WCAG 4.1.2 failure.
      el.style.pointerEvents = abs < 0.5 ? 'auto' : 'none';
    });
    if (counter) {
      counter.textContent =
        `${String(Math.round(progress) + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    }
  }

  // Snap: a slight back-out overshoot reads as spring physics without
  // running an integrator every frame while idle.
  const SNAP = [0.34, 1.32, 0.5, 1];
  let snapRaf = 0;

  function snapTo(target) {
    index = Math.max(0, Math.min(total - 1, Math.round(target)));
    const to = index;
    const from = progress;
    if (from === to) { render(); return; }

    const start = performance.now();
    const dur = 520;
    const bez = cubic(...SNAP);
    cancelAnimationFrame(snapRaf);

    const step = (now) => {
      const t = Math.min((now - start) / dur, 1);
      progress = from + (to - from) * bez(t);
      render();
      if (t < 1) snapRaf = requestAnimationFrame(step);
      else progress = to;
    };
    snapRaf = requestAnimationFrame(step);
  }

  // Minimal cubic-bezier solver — Motion's animate() drives elements, and
  // here the tween is a single scalar that four transforms derive from.
  function cubic(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const fx = (t) => ((ax * t + bx) * t + cx) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      let t = x;
      for (let i = 0; i < 6; i++) {
        const err = fx(t) - x;
        const d = dx(t);
        if (Math.abs(err) < 1e-5 || d === 0) break;
        t -= err / d;
      }
      return ((ay * t + by) * t + cy) * t;
    };
  }

  if (drag) {
    let dragging = false, lastX = 0, startX = 0, samples = [];

    drag.addEventListener('pointerdown', (e) => {
      dragging = true;
      cancelAnimationFrame(snapRaf);
      // Grabbing mid-tween commits to whatever card is visually in front.
      index = Math.max(0, Math.min(total - 1, Math.round(progress)));
      startX = lastX = e.clientX;
      samples = [{ t: performance.now(), x: e.clientX }];
      drag.setPointerCapture(e.pointerId);
    });

    drag.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      progress = Math.max(0, Math.min(total - 1, progress - (e.clientX - lastX) / c.sens));
      lastX = e.clientX;
      samples.push({ t: performance.now(), x: e.clientX });
      if (samples.length > 6) samples.shift();
      render();
    });

    const end = () => {
      if (!dragging) return;
      dragging = false;
      let velocity = 0;
      if (samples.length >= 2) {
        const a = samples[0], b = samples[samples.length - 1];
        const dt = (b.t - a.t) / 1000;
        if (dt > 0) velocity = (b.x - a.x) / dt;
      }
      const shift = Math.max(-1, Math.min(1,
        Math.round(-(lastX - startX) / 150 + -velocity / 650)));
      snapTo(index + shift);
    };

    drag.addEventListener('pointerup', end);
    drag.addEventListener('pointercancel', end);
  }

  $('#work-prev')?.addEventListener('click', () => snapTo(index - 1));
  $('#work-next')?.addEventListener('click', () => snapTo(index + 1));

  // Keeps a card that receives keyboard focus (via its REPO link) in view.
  cards.forEach((card, i) => {
    card.addEventListener('focusin', () => { if (Math.abs(i - progress) > 0.5) snapTo(i); });
  });

  render();
}

/* --------------------------------------------------------------------------
   FAQ — one item open at a time.
   Modern browsers handle this natively via the shared name="faq" attribute;
   this is the fallback for engines that do not support exclusive <details>.
   -------------------------------------------------------------------------- */
if (!('name' in document.createElement('details'))) {
  const items = $$('#faq details');
  items.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (item.open) items.forEach((other) => { if (other !== item) other.open = false; });
    });
  });
}

/* --------------------------------------------------------------------------
   Ambient particle field behind the hero
   Perlin flow field, tinted with the page's own on-surface-variant. Pauses
   entirely when the hero scrolls out of view, and never starts on reduced
   motion or on coarse pointers (phones gain nothing and pay the battery).
   -------------------------------------------------------------------------- */
const canvas = $('#particles');
if (canvas && !reduced && fine) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const host = canvas.parentElement;

  const PERM = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,
    240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,
    33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,
    158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,
    63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,
    109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,
    59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,
    101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,
    97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,
    192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,
    222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  const p = new Array(512);
  for (let i = 0; i < 256; i++) p[256 + i] = p[i] = PERM[i];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);
  const grad = (h, x, y, z) => {
    const g = h & 15;
    const u = g < 8 ? x : y;
    const v = g < 4 ? y : (g === 12 || g === 14 ? x : z);
    return ((g & 1) === 0 ? u : -u) + ((g & 2) === 0 ? v : -v);
  };
  function noise(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(w,
      lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
              lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
      lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
              lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
  }

  let w = 0, h = 0, dpr = 1, particles = [], raf = 0, running = false;

  function resize() {
    const r = host.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5); // capping DPR keeps fill-rate sane on retina
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.round(Math.min(220, (w * h) / 3400));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: Math.random() * 1.3 + 0.4,
      life: Math.random() * 100,
      max: 100 + Math.random() * 60,
    }));
  }

  function frame() {
    ctx.fillStyle = 'rgba(12,13,16,0.14)';
    ctx.fillRect(0, 0, w, h);
    const t = Date.now() * 0.00012;

    for (const d of particles) {
      if (++d.life > d.max) { d.life = 0; d.x = Math.random() * w; d.y = Math.random() * h; }
      const angle = noise(d.x * 0.0025, d.y * 0.0025, t) * Math.PI * 4;
      d.x += Math.cos(angle) * 0.6;
      d.y += Math.sin(angle) * 0.6;
      if (d.x < 0) d.x = w; else if (d.x > w) d.x = 0;
      if (d.y < 0) d.y = h; else if (d.y > h) d.y = 0;

      ctx.beginPath();
      ctx.fillStyle = `rgba(198,196,217,${Math.sin((d.life / d.max) * Math.PI) * 0.32})`;
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }

  const start = () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  resize();
  addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  inView(host, () => { start(); return stop; });
}
