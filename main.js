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

const soundToggles = document.querySelectorAll('[data-sound]');
function setSound(on) {
  soundOn = on;
  soundToggles.forEach((b) => b.setAttribute('aria-pressed', on));
  try { localStorage.setItem('tnf-sound', on ? 'on' : 'off'); } catch {}
}
setSound(soundOn);
requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('snd-ready')));
soundToggles.forEach((b) => b.addEventListener('click', () => {
  setSound(!soundOn);
  if (soundOn) NOTES.forEach((_, i) => sfx.bar(i, i * 0.07)); // a rainbow run to say hello
}));

// Rainbow xylophone: sweep with a mouse, or tap a band on touch screens
document.querySelectorAll('.band').forEach((band, i) => {
  band.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') sfx.bar(i); });
  band.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sfx.bar(i); });
});
document.querySelectorAll('.wall .note').forEach((n) => n.addEventListener('pointerenter', (e) => {
  if (e.pointerType === 'mouse') sfx.tick();
}));
addEventListener('click', (e) => {
  const el = e.target.closest?.('.btn, .round-btn, .menu-btn, .prog-tab, .flip-btn, .nav-links a, .menu-links a, summary');
  if (!el || el.matches('[data-sound]')) return;
  if (el.matches('.flip-btn')) sfx.flip();
  else if (el.matches('.prog-tab')) sfx.blip([...el.parentElement.children].indexOf(el) + 1);
  else sfx.pop();
});

/* Header state, hero scroll depth, timeline progress — one rAF-throttled scroll handler */
const header = document.querySelector('.site-header');
const hero = document.querySelector('.hero');
const tl = document.querySelector('.tl');
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
    if (tl) {
      const r = tl.getBoundingClientRect();
      tl.style.setProperty('--p', clamp01((innerHeight * 0.6 - r.top) / r.height).toFixed(3));
    }
  });
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll, { passive: true });
onScroll();

/* Hero depth: layers drift with the pointer (mouse/trackpad only) */
if (hero && !reduce && matchMedia('(pointer: fine)').matches) {
  hero.addEventListener('pointermove', (e) => {
    hero.style.setProperty('--px', ((e.clientX / innerWidth - 0.5) * 2).toFixed(3));
    hero.style.setProperty('--py', ((e.clientY / innerHeight - 0.5) * 2).toFixed(3));
  });
  hero.addEventListener('pointerleave', () => {
    hero.style.setProperty('--px', 0);
    hero.style.setProperty('--py', 0);
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
document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

/* Mobile menu (native popover): close after picking a link */
const menu = document.getElementById('menu');
menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => menu.hidePopover?.()));

/* Tabs (programmes) — WAI-ARIA tabs pattern */
document.querySelectorAll('[role="tablist"]').forEach((list) => {
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

/* Team carousel buttons */
document.querySelectorAll('[data-scroll]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const track = document.getElementById(btn.getAttribute('aria-controls'));
    const step = track.firstElementChild.getBoundingClientRect().width + 22;
    track.scrollBy({ left: step * Number(btn.dataset.scroll), behavior: reduce ? 'auto' : 'smooth' });
  });
});

/* Myth / fact flip cards: hidden face is inert so focus never lands on it */
document.querySelectorAll('.flip').forEach((card) => {
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
const form = document.getElementById('enquiry');
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

/* Ribbon page transition, in two phases so a slow network never freezes it mid-motion.
   Phase 1 (old page): the bands rise and settle, covering the screen. Then we navigate.
   Phase 2 (new page): wait until the page is ready, then the bands carry on up and off.
   Each phase starts or ends at rest, so waiting just holds a still, covered screen. */
if (!reduce) {
  const D = 700, STEP = 70; // ms per band, ms between bands
  const HOLD = -50;         // vh: where the last band sits while the screen is covered
  const bands = [['--yellow', 8, 50], ['--red', 10, 46], ['--pink', 7, 54], ['--yellow', 9, 48], ['--red', 8, 52]]; // colour, edge sag (vh), arc peak x
  const pt = document.createElement('div');
  pt.className = 'pt';
  pt.setAttribute('aria-hidden', 'true');
  pt.innerHTML = bands.map(([c, s, x]) =>
    `<svg viewBox="0 0 100 200" preserveAspectRatio="none"><path fill="var(${c})" d="M0 0Q${x} ${s * 2} 100 0V200H0Z"/></svg>`).join('');
  document.body.append(pt);

  const slide = (from, to, easing) => [...pt.children].map((el, i) => el.animate(
    [{ transform: `translateY(${from}vh)` }, { transform: `translateY(${to}vh)` }],
    { duration: D, delay: i * STEP, easing, fill: 'both' }));
  const done = (anims) => Promise.all(anims.map((a) => a.finished));
  const reset = () => { pt.getAnimations({ subtree: true }).forEach((a) => a.cancel()); pt.classList.remove('on'); };

  // Arriving: sit covered, wait for fonts and images (but never more than 1.2s), then reveal
  let arrived = false;
  try { arrived = !!sessionStorage.getItem('pt'); sessionStorage.removeItem('pt'); } catch {}
  if (arrived) {
    pt.classList.add('on');
    const reveal = slide(HOLD, -200, 'cubic-bezier(.65,0,.35,1)');
    reveal.forEach((a) => a.pause());
    document.documentElement.classList.remove('pt-in');
    const loaded = document.readyState === 'complete' ? 0 : new Promise((r) => addEventListener('load', r, { once: true }));
    const go = () => reveal.forEach((a) => a.play());
    Promise.race([Promise.all([document.fonts.ready, loaded]), new Promise((r) => setTimeout(r, 1200))])
      .then(() => requestAnimationFrame(() => requestAnimationFrame(go)));
    setTimeout(go, 1800); // safety net: never leave the page covered
    done(reveal).then(reset, () => {});
  }

  // Warm the next page early: on hover/touch, and again the moment the click starts the cover
  const warmed = new Set();
  const warm = (a) => {
    if (warmed.has(a.href)) return;
    warmed.add(a.href);
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.href = a.href;
    document.head.append(l);
  };
  const internal = (a) => a && a.origin === location.origin && !a.target && !a.hasAttribute('download') &&
    !(a.pathname === location.pathname && a.search === location.search);
  for (const ev of ['pointerenter', 'touchstart', 'focusin']) {
    document.addEventListener(ev, (e) => { const a = e.target.closest?.('a[href]'); if (internal(a)) warm(a); }, { capture: true, passive: true });
  }

  let leaving = false;
  addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (!internal(a) || leaving || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    leaving = true;
    warm(a);
    pt.classList.add('on');
    done(slide(100, HOLD, 'cubic-bezier(.45,0,.2,1)')).then(() => {
      try { sessionStorage.setItem('pt', '1'); } catch {}
      location.href = a.href;
    });
  });
  // Back/forward cache restores the page mid-cover: clear it
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    leaving = false;
    reset();
    try { sessionStorage.removeItem('pt'); } catch {}
  });
}
