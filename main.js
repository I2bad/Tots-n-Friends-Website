// Tots & Friends — shared behaviour. No libraries.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (n) => Math.min(Math.max(n, 0), 1);

/* Sound effects. Off until the visitor turns them on; the choice is remembered.
   Made live with Web Audio, so there are no sound files to load.
   The hero rainbow is a xylophone: pentatonic notes, so any sweep sounds nice. */
const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]; // C D E G A C, outer band lowest
let soundOn = false;
let unlocked = false; // browsers only allow audio after a real tap, click or key press
let actx = null;
let master = null;
try { soundOn = localStorage.getItem('tnf-sound') === 'on'; } catch {}
const unlock = () => { unlocked = true; };
addEventListener('pointerdown', unlock, { once: true, capture: true });
addEventListener('keydown', unlock, { once: true, capture: true });

function voice(freq, { to, type = 'sine', dur = 0.5, gain = 0.3, at = 0 } = {}) {
  if (!soundOn || !unlocked) return;
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    master.gain.value = 0.35; // quiet on purpose
    master.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
  const t = actx.currentTime + at;
  const osc = actx.createOscillator();
  const env = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
const sfx = {
  bar: (i, at = 0) => { voice(NOTES[i], { dur: 1.1, gain: 0.32, at }); voice(NOTES[i] * 4, { dur: 0.12, gain: 0.07, at }); },
  pop: () => voice(620, { to: 260, dur: 0.12, gain: 0.22, type: 'triangle' }),
  tick: () => voice(1800, { to: 1300, dur: 0.05, gain: 0.06, type: 'triangle' }),
  blip: (i) => voice(NOTES[i], { dur: 0.25, gain: 0.2, type: 'triangle' }),
  flip: () => voice(260, { to: 780, dur: 0.22, gain: 0.12, type: 'triangle' }),
  chime: () => [0, 2, 4, 5].forEach((n, k) => sfx.bar(n, k * 0.09)),
};

const toggles = () => document.querySelectorAll('[data-sound]');
function setSound(on) {
  soundOn = on;
  toggles().forEach((b) => b.setAttribute('aria-pressed', on));
  try { localStorage.setItem('tnf-sound', on ? 'on' : 'off'); } catch {}
}

addEventListener('click', (e) => {
  const el = e.target.closest?.('.btn, .round-btn, .menu-btn, .prog-tab, .flip-btn, .nav-links a, .menu-links a, summary');
  if (!el || el.matches('[data-sound]')) return;
  if (el.matches('.flip-btn')) sfx.flip();
  else if (el.matches('.prog-tab')) sfx.blip([...el.parentElement.children].indexOf(el) + 1);
  else sfx.pop();
});

/* Header state, hero scroll depth and per-page scroll effects: one rAF-throttled scroll handler */
const header = document.querySelector('.site-header');
let hero = null;
let scrollers = []; // per-page scroll effects, rebuilt by init() after each page swap
let sizers = [];    // per-page measurements, rerun on resize
let queued = false;
function onScroll() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    header?.classList.toggle('scrolled', scrollY > 8);
    if (hero && !reduce) {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--sy', clamp01(-r.top / r.height).toFixed(3));
    }
    for (const fn of scrollers) fn();
  });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => { sizers.forEach((fn) => fn()); onScroll(); }, { passive: true });

/* Home, "Why parents choose us": one day at Tots. Scrolling down moves the day sideways,
   the sky changes with the time of day and the sun crosses it. */
const SKY = [['#fde3c8', '#fbf5ea'], ['#d9ebfb', '#f6f1e7'], ['#c4e0f8', '#eef5fb'], ['#fde9b8', '#fbf5ea'], ['#f8cdbf', '#fbe6dc'], ['#1d1930', '#3a2f66']]; // paper-tinted skies, top to bottom; night uses the site ink
function initDay(root) {
  const pin = root.querySelector('[data-day] .day-pin');
  if (!pin) return;
  const stage = pin.querySelector('.day-stage');
  const track = pin.querySelector('.day-track');
  const sun = pin.querySelector('.day-sun');
  const panels = [...track.children];
  const stops = [...pin.querySelectorAll('.day-ruler li')];
  const last = panels.length - 1;
  let on = -1;
  scrollers.push(() => {
    const r = pin.getBoundingClientRect();
    const p = clamp01(-r.top / (r.height - innerHeight));
    track.style.transform = `translateX(${-p * (track.scrollWidth - innerWidth)}px)`;
    stage.style.setProperty('--p', p.toFixed(4));
    const night = clamp01((p - 0.82) / 0.14), arc = clamp01(p / 0.9);
    stage.style.setProperty('--night', night.toFixed(3));
    sun.style.left = `${8 + arc * 84}%`;
    sun.style.top = `${66 - Math.sin(Math.PI * arc) * 50 + night * 34}%`;
    const now = Math.round(p * last);
    if (now === on) return;
    on = now;
    panels.forEach((el, i) => el.classList.toggle('on', i === on));
    stops.forEach((el, i) => el.classList.toggle('done', i <= on));
    stage.style.setProperty('--s1', SKY[on % SKY.length][0]);
    stage.style.setProperty('--s2', SKY[on % SKY.length][1]);
    stage.classList.toggle('is-night', on === last);
  });
}

/* Our Story timeline: the years slide sideways as you scroll down (after landonorris.com).
   Laid out at 900px tall and zoomed to the screen. Photos drift a little slower than their frames.
   Under 768px it is a normal column, and years just light up as they come into view. */
function initWalk(root) {
  const sec = root.querySelector('[data-walk]');
  if (!sec) return;
  const track = sec.querySelector('.walk-track');
  const inner = sec.querySelector('.walk-inner');
  const chs = [...inner.children];
  const pols = [...sec.querySelectorAll('.pol')];
  const wide = matchMedia('(min-width: 768px)');
  let travel = 0, zoom = 1;
  const size = () => {
    if (!wide.matches) { sec.style.height = ''; inner.style.zoom = ''; track.style.transform = ''; return; }
    zoom = Math.max(0.6, innerHeight / 900);
    inner.style.zoom = zoom.toFixed(4);
    travel = track.getBoundingClientRect().width - innerWidth;
    sec.style.height = `${Math.max(innerHeight, travel)}px`;
  };
  size();
  sizers.push(size);
  scrollers.push(() => {
    if (!wide.matches) {
      chs.forEach((c) => { if (c.getBoundingClientRect().top < innerHeight * 0.8) c.classList.add('in'); });
      return;
    }
    const d = Math.min(Math.max(innerHeight - sec.getBoundingClientRect().top, 0), travel); // starts as the section rises in
    track.style.transform = `translateX(${-d}px)`;
    sec.style.setProperty('--d', d.toFixed(0));
    const mid = innerWidth * 0.55;
    for (const c of chs) {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--f', clamp01((mid - r.left) / r.width).toFixed(3));
      if (r.left < mid) c.classList.add('in');
    }
    if (!reduce) for (const el of pols) {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--k', clamp01((innerWidth - r.left) / (innerWidth + r.width)).toFixed(3));
    }
  });
}

/* Reveal on scroll + number counters */
function count(el) {
  const raw = el.dataset.count;
  const to = parseFloat(raw);
  const decimals = (raw.split('.')[1] || '').length;
  const suffix = el.dataset.suffix || '';
  const show = (v) => { el.textContent = v.toFixed(decimals) + suffix; };
  if (reduce) return show(to);
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min((now - start) / 1600, 1);
    show(to * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
const io = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    en.target.classList.add('in');
    en.target.querySelectorAll('[data-count]').forEach(count);
    io.unobserve(en.target);
  }
}, { rootMargin: '0px 0px -12% 0px' });

/* The full-screen popover keeps keyboard and screen-reader focus inside the mobile menu. */
const menu = document.getElementById('menu');
if (menu) {
  const controls = [...menu.querySelectorAll('button, a[href]')];
  const mobileNav = matchMedia('(max-width: 920px)');
  let locked = [];
  menu.addEventListener('toggle', () => {
    if (!menu.matches(':popover-open')) return;
    locked = [...document.body.children].filter((el) => el !== menu && !el.inert &&
      el.matches('.skip, .site-header, main, .site-footer, .wa-float'));
    locked.forEach((el) => { el.inert = true; });
  });
  menu.addEventListener('beforetoggle', ({ newState }) => {
    if (newState !== 'closed') return;
    locked.forEach((el) => { el.inert = false; });
    locked = [];
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', (event) => {
    if (!(event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)) menu.hidePopover();
  }));
  mobileNav.addEventListener('change', ({ matches }) => {
    if (!matches && menu.matches(':popover-open')) menu.hidePopover();
  });
}

/* Repeat short review lists so the sides of the carousel stay filled as it loops. */
function initTestimonials(carousel) {
  const stage = carousel.querySelector('.quote-grid');
  const cards = [...stage.querySelectorAll('.quote')];
  const reviewCount = cards.length;
  if (!reviewCount) return;

  const deckSize = Math.ceil(9 / reviewCount) * reviewCount;
  for (let i = reviewCount; i < deckSize; i++) {
    const copy = cards[i % reviewCount].cloneNode(true);
    cards.push(copy);
    stage.append(copy);
  }

  const controls = carousel.querySelector('.quote-controls');
  const status = carousel.querySelector('[role="status"]');
  const half = Math.floor(deckSize / 2);
  let current = 0;
  let swipeStart = null;
  let ignoreCardClick = false;

  const show = (index, announce = true) => {
    current = (index + deckSize) % deckSize;
    cards.forEach((card, i) => {
      const position = (i - current + half + deckSize) % deckSize - half;
      card.classList.toggle('quote-wrap', Math.abs(position - Number(card.dataset.position)) > half);
      card.dataset.position = position;
      card.style.setProperty('--quote-index', position);
      card.toggleAttribute('data-odd', position % 2 !== 0);
      card.setAttribute('aria-hidden', i !== current);
    });

    if (announce) {
      const card = cards[current];
      const name = card.querySelector('figcaption strong').textContent;
      const quote = card.querySelector('blockquote').textContent;
      status.textContent = `Testimonial from ${name}. ${quote}`;
    }
  };

  controls.querySelectorAll('[data-quote-step]').forEach((button) => {
    button.addEventListener('click', () => show(current + Number(button.dataset.quoteStep)));
  });
  controls.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    show(current + (event.key === 'ArrowLeft' ? -1 : 1));
  });
  stage.addEventListener('click', (event) => {
    const card = event.target.closest('.quote');
    if (card && !ignoreCardClick && card !== cards[current]) show(cards.indexOf(card));
  });
  stage.addEventListener('pointerdown', (event) => {
    ignoreCardClick = false;
    if (event.pointerType === 'touch' && event.isPrimary) {
      swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    }
  });
  stage.addEventListener('pointerup', (event) => {
    if (swipeStart?.id !== event.pointerId) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
    ignoreCardClick = true;
    show(current + (dx < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', () => { swipeStart = null; });

  show(0, false);
  carousel.setAttribute('role', 'group');
  carousel.setAttribute('aria-roledescription', 'carousel');
  carousel.setAttribute('aria-label', 'Parent testimonials');
  carousel.classList.add('is-ready');
  controls.hidden = false;
}

/* Everything that lives inside a page. Runs on first load for the whole document,
   and again for the new <main> each time the page transition swaps one in. */
function init(root) {
  toggles().forEach((b) => b.setAttribute('aria-pressed', soundOn));
  root.querySelectorAll('[data-sound]').forEach((b) => b.addEventListener('click', () => {
    setSound(!soundOn);
    if (soundOn) NOTES.forEach((_, i) => sfx.bar(i, i * 0.07)); // a rainbow run to say hello
  }));

  // Rainbow xylophone: sweep with a mouse, or tap a band on touch screens
  root.querySelectorAll('.band').forEach((band, i) => {
    band.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') sfx.bar(i); });
    band.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sfx.bar(i); });
  });

  hero = root.querySelector('.hero');
  scrollers = [];
  sizers = [];
  initDay(root);
  initWalk(root);
  /* Hero depth: layers drift with the pointer (mouse/trackpad only) */
  if (hero && !reduce && matchMedia('(pointer: fine)').matches) {
    const h = hero;
    h.addEventListener('pointermove', (e) => {
      h.style.setProperty('--px', ((e.clientX / innerWidth - 0.5) * 2).toFixed(3));
      h.style.setProperty('--py', ((e.clientY / innerHeight - 0.5) * 2).toFixed(3));
    });
    h.addEventListener('pointerleave', () => {
      h.style.setProperty('--px', 0);
      h.style.setProperty('--py', 0);
    });
  }

  root.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

  /* Tabs (programmes): WAI-ARIA tabs pattern */
  root.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const select = (tab, focus) => {
      for (const t of tabs) {
        const on = t === tab;
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      }
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        let next = null;
        if (step) next = tabs[(i + step + tabs.length) % tabs.length];
        if (e.key === 'Home') next = tabs[0];
        if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
  });

  root.querySelectorAll('[data-testimonials]').forEach(initTestimonials);

  /* Team carousel buttons */
  root.querySelectorAll('[data-scroll]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const track = document.getElementById(btn.getAttribute('aria-controls'));
      const step = track.firstElementChild.getBoundingClientRect().width + 22;
      track.scrollBy({ left: step * Number(btn.dataset.scroll), behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* Myth / fact flip cards: hidden face is inert so focus never lands on it */
  root.querySelectorAll('.flip').forEach((card) => {
    const [front, back] = card.querySelectorAll('.face');
    back.inert = true;
    card.querySelectorAll('.flip-btn').forEach((b) => b.addEventListener('click', () => {
      const flipped = card.classList.toggle('is-flipped');
      front.inert = flipped;
      back.inert = !flipped;
      (flipped ? back : front).querySelector('.flip-btn').focus({ preventScroll: true });
    }));
  });

  /* Contact form: no server, so it hands the message to WhatsApp */
  const form = root.querySelector('#enquiry');
  if (form) {
    const done = document.getElementById('enquiry-done');
    const waLink = done.querySelector('[data-wa]');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const text = [
        `Hi Tots & Friends! (${f.get('enquiry')})`,
        '',
        `Name: ${f.get('name')}`,
        `Email: ${f.get('email')}`,
        `Phone: ${f.get('phone')}`,
        '',
        f.get('message'),
      ].join('\n');
      const url = 'https://wa.me/60173078621?text=' + encodeURIComponent(text);
      waLink.href = url;
      window.open(url, '_blank', 'noopener');
      sfx.chime();
      form.hidden = true;
      done.hidden = false;
      done.focus();
    });
    done.querySelector('[data-reset]').addEventListener('click', () => {
      form.reset();
      done.hidden = true;
      form.hidden = false;
      form.querySelector('input').focus();
    });
  }

  /* Progress check: one area per screen, scores stay in the browser */
  const chk = root.querySelector('[data-check]');
  if (chk) {
    const steps = [...chk.querySelectorAll('.step')];
    const dots = [...chk.querySelectorAll('.dots li')];
    const [prev, next] = [chk.querySelector('[data-prev]'), chk.querySelector('[data-next]')];
    const out = root.querySelector('[data-result]');
    const LEVEL = [ // 5-6 of 6 points, 3-4, 0-2
      { name: 'Growing well', icon: '#i-check', msg: 'Your child is doing well here. Keep doing what you already do.' },
      { name: 'Worth watching', icon: '#i-clock', msg: 'Every child has areas that take a little longer. Try the idea below for three or four weeks, then tell your child’s teacher what you notice.' },
      { name: 'Let’s talk', icon: '#i-wa', msg: 'Please talk to your child’s teacher. We can show you what we see in class and plan next steps together.' },
    ];
    let at = 0;
    const answered = () => steps[at].querySelectorAll('.q input:checked').length === steps[at].querySelectorAll('.q').length;
    const show = (n) => {
      at = n;
      steps.forEach((s, i) => { s.hidden = i !== n; });
      dots.forEach((d, i) => { d.className = i <= n ? 'on' : ''; });
      chk.querySelector('[data-stepcount]').textContent = `Area ${n + 1} of ${steps.length} · ${steps[n].dataset.name}`;
      prev.disabled = n === 0;
      next.textContent = n === steps.length - 1 ? 'See my child’s picture' : 'Next';
      next.disabled = !answered();
    };
    chk.addEventListener('change', () => { next.disabled = !answered(); sfx.tick(); });
    prev.addEventListener('click', () => show(at - 1));
    next.addEventListener('click', () => {
      if (at < steps.length - 1) return show(at + 1);
      const pts = steps.map((s) => [...s.querySelectorAll('.q input:checked')].reduce((t, i) => t + Number(i.value), 0));
      const lv = pts.map((p) => (p >= 5 ? 0 : p >= 3 ? 1 : 2));
      out.querySelectorAll('.fill path').forEach((p, i) => p.style.setProperty('--to', 1 - pts[i] / 6));
      out.querySelectorAll('[data-card]').forEach((li, i) => {
        li.dataset.level = lv[i];
        li.querySelector('use').setAttribute('href', LEVEL[lv[i]].icon);
        li.querySelector('.status span').textContent = LEVEL[lv[i]].name;
        li.querySelector('.msg').textContent = LEVEL[lv[i]].msg;
        li.querySelector('.tip span').textContent = steps[i].dataset.tip;
      });
      out.querySelector('[data-flag]').hidden = lv.filter((l) => l === 2).length < 2;
      chk.hidden = true;
      out.hidden = false;
      sfx.chime();
      const h = out.querySelector('h2');
      h.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      h.focus({ preventScroll: true });
    });
    out.querySelector('[data-redo]').addEventListener('click', () => {
      chk.reset();
      out.hidden = true;
      chk.hidden = false;
      show(0);
      chk.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
    show(0);
  }

  onScroll();
}
init(document);
// Fonts change text widths, so re-measure the sideways sections once they arrive.
document.fonts?.ready.then(() => { sizers.forEach((fn) => fn()); onScroll(); });

/* Ribbon page transition (after cue146 on cuedesign.space).
   One document, no reload: a link click fetches the next page while five curved bands sweep up
   and cover the screen. When the cover is complete the <main> is swapped (the screen is covered and
   still, so heavy work cannot make it jank), then the bands lift off to reveal the new page.
   The network only has to beat the sweep (about 1s), and hovering a link starts the fetch early.
   Anything unexpected falls back to a normal page load. */
if (!reduce && /^https?:$/.test(location.protocol) && history.pushState) {
  const IN = 480, STEP = 132, OUT = 650; // ms: cover (per band, gap between bands), reveal. Cover total = IN + 4 * STEP, about 1s
  const HOLD = -22;                      // vh: where the bands rest while the screen is covered
  const H = 128;                         // vh: band height
  const colours = ['--yellow', '--red', '--pink', '--yellow', '--red'];
  const pt = document.createElement('div');
  pt.className = 'pt';
  pt.setAttribute('aria-hidden', 'true');
  pt.innerHTML = colours.map((c) => `<svg viewBox="0 0 100 ${H}" preserveAspectRatio="none"><path fill="var(${c})"/></svg>`).join('');
  pt.popover = 'manual'; // top layer: stays above an open or closing menu
  document.body.append(pt);
  const kids = [...pt.children];

  // Liquid, not tidy: every band gets its own hand-drawn edge (tilt, depth, where the dip lands),
  // sways (skews) as it travels, and runs at its own pace. A new look on every click.
  const rand = (a, b) => a + Math.random() * (b - a);
  const EASES = ['cubic-bezier(.65,0,.35,1)', 'cubic-bezier(.55,0,.3,1)', 'cubic-bezier(.72,0,.42,1)'];
  const edge = () => {
    const sag = rand(5, 9), L = rand(-3, 3), R = rand(-3, 3);
    return `M0 ${L.toFixed(1)}C${rand(16, 44).toFixed(1)} ${(L + sag * rand(1.3, 1.9)).toFixed(1)} ${rand(56, 84).toFixed(1)} ${(R + sag * rand(1.3, 1.9)).toFixed(1)} 100 ${R.toFixed(1)}V${H}H0Z`;
  };
  const sway = (el, from, to, [s0, s1, s2], easing, duration, delay) => el.animate([
    { transform: `translateY(${from}vh) skewY(${s0}deg)` },
    { transform: `translateY(${(from + to) / 2}vh) skewY(${s1}deg)`, offset: 0.5 },
    { transform: `translateY(${to}vh) skewY(${s2}deg)` },
  ], { duration, delay: Math.max(0, delay), easing, fill: 'both' }).finished;
  let look = [];
  const roll = () => {
    kids.forEach((el) => el.firstChild.setAttribute('d', edge()));
    look = kids.map(() => ({ s: [rand(-2.5, 2.5), rand(-2.5, 2.5), rand(-1.2, 1.2)], ease: EASES[Math.floor(Math.random() * EASES.length)], k: rand(0.92, 1.12), j: rand(-30, 50) }));
  };
  const cover = () => Promise.all(kids.map((el, i) => sway(el, 100, HOLD, look[i].s, look[i].ease, IN * look[i].k, i * STEP + look[i].j)));
  const lift = () => Promise.all(kids.map((el, i) => sway(el, HOLD, -(H + 14), [look[i].s[2], rand(-2, 2), rand(-2, 2)], look[i].ease, OUT * rand(0.95, 1.1), (kids.length - 1 - i) * 16)));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const frames = (n) => new Promise((r) => { const f = () => (n-- > 0 ? requestAnimationFrame(f) : r()); f(); });
  const reset = () => { pt.getAnimations({ subtree: true }).forEach((a) => a.cancel()); pt.classList.remove('on'); try { pt.hidePopover(); } catch {} };

  // Fetch pages once per session; hovering a link warms the cache
  const pages = new Map();
  const load = (href) => {
    const u = new URL(href, location.href);
    u.hash = '';
    if (!pages.has(u.href)) {
      pages.set(u.href, fetch(u.href).then(async (res) => {
        if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html')) throw new Error(res.status);
        return { url: res.url, html: await res.text() };
      }).catch((err) => { pages.delete(u.href); throw err; }));
    }
    return pages.get(u.href);
  };

  // Decode the new page's first images while the bands are still rising, so they do not pop in
  const preload = (doc) => Promise.all([...doc.querySelectorAll('main img[src]')].slice(0, 8).map((img) => {
    const im = new Image();
    im.src = new URL(img.getAttribute('src'), location.href).href;
    return im.decode().catch(() => {});
  }));

  let shown = location.pathname + location.search; // which page is on screen
  let busy = false;
  const swap = ({ url, html }, hash, push) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const next = doc.querySelector('main');
    if (!next) throw new Error('no main');
    document.title = doc.title;
    for (const [sel, attr] of [['meta[name="description"]', 'content'], ['link[rel="canonical"]', 'href']]) {
      const mine = document.head.querySelector(sel), theirs = doc.head.querySelector(sel);
      if (mine && theirs) mine.setAttribute(attr, theirs.getAttribute(attr));
    }
    const theirs = doc.querySelectorAll('.nav-links a, .menu-links a');
    document.querySelectorAll('.nav-links a, .menu-links a').forEach((a, i) => {
      const c = theirs[i]?.getAttribute('aria-current');
      if (c) a.setAttribute('aria-current', c); else a.removeAttribute('aria-current');
    });
    document.querySelector('main').replaceWith(document.adoptNode(next));
    const u = new URL(url, location.href);
    if (push) history.pushState(null, '', u.pathname + u.search + hash);
    shown = u.pathname + u.search;
    scrollTo({ top: 0, behavior: 'instant' });
    init(next);
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    next.tabIndex = -1;
    next.focus({ preventScroll: true });
  };

  const go = async (href, push = true) => {
    busy = true;
    const hash = new URL(href, location.href).hash;
    roll();
    pt.classList.add('on');
    try { pt.showPopover(); } catch {}
    const page = load(href);
    const images = page.then(({ html }) => preload(new DOMParser().parseFromString(html, 'text/html'))).catch(() => {}); // starts as soon as the HTML lands
    try {
      const [, { url, html }] = await Promise.all([cover(), page]);
      await Promise.race([images, wait(250)]);
      swap({ url, html }, hash, push);
      await frames(2);                                          // let the new page paint under the cover
      await lift();
    } catch {
      location.href = href;                                     // never trap the visitor
      return;
    }
    reset();
    busy = false;
  };

  const internal = (a) => a && /^https?:$/.test(a.protocol) && a.origin === location.origin && !a.target &&
    !a.hasAttribute('download') && !(a.pathname === location.pathname && a.search === location.search);
  for (const ev of ['pointerenter', 'touchstart', 'focusin']) {
    document.addEventListener(ev, (e) => { const a = e.target.closest?.('a[href]'); if (internal(a)) load(a.href).catch(() => {}); }, { capture: true, passive: true });
  }
  addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (!internal(a) || busy || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(a.href);
  });
  addEventListener('popstate', () => {
    if (location.pathname + location.search === shown) return; // only the #hash changed
    if (busy) location.reload();
    else go(location.href, false);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) { reset(); busy = false; } });
}
