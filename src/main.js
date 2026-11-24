import 'lenis/dist/lenis.css';
import './styles.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { $, $$, clamp, env, splitWords, splitChars, makeGrain } from './modules/utils.js';
import { createAperture } from './modules/aperture.js';
import { createLatent } from './modules/latent.js';
import { initCursor } from './modules/cursor.js';
import { sound } from './modules/sound.js';

gsap.registerPlugin(ScrollTrigger);

const html = document.documentElement;
const REDUCED = env.reduced;
html.classList.add('js');
if (REDUCED) html.classList.add('reduced');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

$('.grain').style.backgroundImage = `url(${makeGrain()})`;

/* ──────────────────────────────────────────────────────────────
   Smooth scroll (off for reduced motion)
   ────────────────────────────────────────────────────────────── */
let lenis = null;
if (!REDUCED) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const expoInOut = (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);
function scrollToTarget(target, duration = 2) {
  if (lenis) lenis.scrollTo(target, { duration, easing: expoInOut });
  else (typeof target === 'number' ? window.scrollTo(0, target) : target.scrollIntoView());
}

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = id.length > 1 && $(id);
    if (!el) return;
    e.preventDefault();
    scrollToTarget(el, 2.2);
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });
});

/* ──────────────────────────────────────────────────────────────
   HUD — timecode, frame counter, live exposure readout
   ────────────────────────────────────────────────────────────── */
const hud = {
  tc: $('.hud__tc'), roll: $('.hud__num-roll'), chapter: $('.hud__chapter'),
  f: $('.hud__f'), s: $('.hud__s'), iso: $('.hud__iso'),
  rail: $$('.rail a'), current: -1,
};
const STOPS = ['1.4', '1.8', '2', '2.8', '4', '5.6', '8', '11', '16'];
const SHUTTERS = ['1/60', '1/125', '1/250', '1/500', '1/1000', '1/2000', '1/4000'];
const pointer = { x: 0.3, y: 0.5 };
window.addEventListener('pointermove', (e) => { pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight; }, { passive: true });

let lastFrame = -1, lastF = '', lastS = '', smoothVel = 0;
const t0 = performance.now();
gsap.ticker.add(() => {
  const el = (performance.now() - t0) / 1000;
  const fr = Math.floor(el * 24);
  if (fr !== lastFrame) {
    lastFrame = fr;
    const pad = (n) => String(n).padStart(2, '0');
    hud.tc.textContent = `${pad(Math.floor(el / 3600))}:${pad(Math.floor(el / 60) % 60)}:${pad(Math.floor(el) % 60)}:${pad(fr % 24)}`;
  }
  const f = STOPS[clamp(Math.round(pointer.x * (STOPS.length - 1)), 0, STOPS.length - 1)];
  if (f !== lastF) { hud.f.textContent = f; lastF = f; }
  const v = Math.abs(lenis ? lenis.velocity : 0);
  smoothVel += (v - smoothVel) * 0.1;
  const s = SHUTTERS[clamp(Math.round(smoothVel / 7), 0, SHUTTERS.length - 1) ];
  if (s !== lastS) { hud.s.textContent = s; lastS = s; }
});

function setChapter(i, sec) {
  if (i === hud.current) return;
  const dir = i > hud.current ? 1 : -1;
  hud.current = i;
  hud.rail.forEach((a, k) => a.classList.toggle('is-active', k === i));
  hud.chapter.textContent = sec.dataset.chapter;
  hud.iso.textContent = sec.dataset.iso;
  const next = String(i + 1).padStart(2, '0');
  if (REDUCED) { hud.roll.textContent = next; return; }
  gsap.timeline()
    .to(hud.roll, { yPercent: -100 * dir, duration: 0.25, ease: 'power2.in' })
    .add(() => { hud.roll.textContent = next; sound.tick(0.12); })
    .fromTo(hud.roll, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.45, ease: 'expo.out' });
}

/* ──────────────────────────────────────────────────────────────
   01 · LATENT — WebGL negative that develops under the cursor
   ────────────────────────────────────────────────────────────── */
const heroSrc = innerWidth < 768 ? '/img/hero-wisuda-800.webp' : '/img/hero-wisuda-1600.webp';
const latent = REDUCED ? null : createLatent($('.latent__gl'), heroSrc);
if (!latent) html.classList.add('no-gl');

const nameChars = $$('.latent__name .ln').flatMap((ln) => splitChars(ln));

if (latent) {
  let heroVisible = true;
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe($('.latent__stage'));
  gsap.ticker.add((time, delta) => { if (heroVisible) latent.frame(delta); });
}

/* ──────────────────────────────────────────────────────────────
   00 · Loader → iris opens → intro choreography
   ────────────────────────────────────────────────────────────── */
const loaderIris = createAperture($('.loader__iris'), { blades: 9 });
const introHidden = ['.hud', '.rail', '.viewfinder', '.latent__eyebrow', '.latent__tag', '.latent__cta', '.latent__hint', '.latent__scroll'];

function finishLoading() {
  document.body.classList.remove('is-loading');
  $('.loader')?.remove();
  lenis?.start();
  ScrollTrigger.refresh();
}

if (REDUCED) {
  finishLoading();
} else {
  gsap.set(introHidden, { autoAlpha: 0 });
  gsap.set(nameChars, { yPercent: 115, rotate: 7, transformOrigin: '0% 100%' });

  const count = $('.loader__count');
  const counter = { v: 0 };
  const ready = Promise.all([
    document.fonts?.ready ?? Promise.resolve(),
    latent ? latent.loaded : Promise.resolve(),
  ]);
  const minTime = new Promise((r) => setTimeout(r, 1500));

  // count runs towards 30 while loading, finishes to 36 once ready
  const pre = gsap.to(counter, { v: 30, duration: 2.4, ease: 'power1.out', onUpdate: () => { count.textContent = String(Math.round(counter.v)).padStart(2, '0'); } });

  Promise.all([ready, minTime]).then(() => {
    pre.kill();
    const iris = { r: 0 };
    gsap.timeline({ onComplete: finishLoading })
      .to(counter, { v: 36, duration: 0.5, ease: 'power2.out', onUpdate: () => { count.textContent = String(Math.round(counter.v)).padStart(2, '0'); } })
      .to(['.loader__readout', '.loader__meta'], { autoAlpha: 0, duration: 0.35 }, '+=0.15')
      .add(() => sound.shutter())
      .to(iris, { r: 150, duration: 1.7, ease: 'expo.inOut', onUpdate: () => loaderIris.draw(iris.r) }, '<')
      .to(latent ? latent.state : {}, { intro: 1, duration: 2.4, ease: 'power2.out' }, '<+0.3')
      .to(nameChars, { yPercent: 0, rotate: 0, duration: 1.4, ease: 'expo.out', stagger: 0.035 }, '<+0.45')
      .to(introHidden, { autoAlpha: 1, duration: 1.2, stagger: 0.06, ease: 'power2.out' }, '<+0.5');
  });
}

/* ──────────────────────────────────────────────────────────────
   Scroll choreography
   ────────────────────────────────────────────────────────────── */
const mm = gsap.matchMedia();


if (!REDUCED) {
  // ── Hero: develop the whole frame, then it becomes a print ──
  gsap.set('.latent__stage', { clipPath: 'inset(0% 0% 0% 0%)' });
  const heroTl = gsap.timeline({
    scrollTrigger: { trigger: '.latent', start: 'top top', end: '+=130%', pin: '.latent__stage', scrub: 0.7 },
  });
  if (latent) heroTl.to(latent.state, { develop: 1, ease: 'power1.inOut', duration: 0.75 }, 0);
  heroTl
    .fromTo(['.latent__eyebrow', '.latent__tag', '.latent__cta', '.latent__hint', '.latent__scroll'],
      { autoAlpha: 1, y: 0 },
      { autoAlpha: 0, y: -40, stagger: 0.02, duration: 0.25, immediateRender: false }, 0)
    .to('.latent__name .ln--1', { xPercent: -6, duration: 0.8 }, 0)
    .to('.latent__name .ln--2', { xPercent: 5, duration: 0.8 }, 0)
    .to('.latent__name .ln--3', { yPercent: -120, autoAlpha: 0, duration: 0.5 }, 0.1)
    .to('.latent__stage', { clipPath: 'inset(12% 26% 16% 26%)', duration: 0.35, ease: 'power3.inOut' }, 0.65)
    .to('.latent__name', { autoAlpha: 0, scale: 0.9, transformOrigin: '0% 100%', duration: 0.3 }, 0.65);
}

// ── Focus: a focus-pull from 0.3 m to infinity ──
const titleWords = splitWords($('.focus__title'));
const bodyWords = $$('.focus__text').flatMap((p) => splitWords(p));
const scaleTrack = $('.focus__scale-track');

if (!REDUCED) {
  mm.add('(min-width: 769px)', () => {
    const unit = () => scaleTrack.children[0].offsetWidth;
    gsap.set(titleWords, { filter: 'blur(22px)', opacity: 0.2, scale: 1.05 });
    gsap.set(bodyWords, { filter: 'blur(8px)', opacity: 0.1 });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: '.focus', start: 'top top', end: '+=190%', pin: '.focus__pin', scrub: 0.6, invalidateOnRefresh: true },
    });
    tl.to(titleWords, { filter: 'blur(0px)', opacity: 1, scale: 1, stagger: 0.08, duration: 0.35, ease: 'power2.out' }, 0)
      .to(bodyWords, { filter: 'blur(0px)', opacity: 1, stagger: 0.01, duration: 0.12, ease: 'none' }, 0.3)
      .fromTo(scaleTrack, { x: () => -unit() * 0.5 }, { x: () => -unit() * 9.5, ease: 'power1.inOut', duration: 1.15 }, 0);
  });
  mm.add('not all and (min-width: 769px)', () => {
    const unit = () => scaleTrack.children[0].offsetWidth;
    gsap.fromTo(titleWords, { opacity: 0.12, y: 20 }, { opacity: 1, y: 0, stagger: 0.1, scrollTrigger: { trigger: '.focus__title', start: 'top 85%', end: 'bottom 55%', scrub: true } });
    $$('.focus__text').forEach((p) => {
      gsap.fromTo($$('.w', p), { opacity: 0.12 }, { opacity: 1, stagger: 0.05, scrollTrigger: { trigger: p, start: 'top 85%', end: 'bottom 60%', scrub: true } });
    });
    gsap.fromTo(scaleTrack, { x: () => -unit() * 0.5 }, { x: () => -unit() * 9.5, ease: 'none', scrollTrigger: { trigger: '.focus', start: 'top 60%', end: 'bottom 60%', scrub: true, invalidateOnRefresh: true } });
  });
}

// ── Light meter ──
function buildOdometer(el) {
  const target = el.dataset.odo;
  el.textContent = '';
  el.setAttribute('aria-label', target);
  const cols = [];
  [...target].forEach((ch) => {
    const d = document.createElement('span');
    d.className = 'd';
    d.setAttribute('aria-hidden', 'true');
    if (/\d/.test(ch)) {
      const n = +ch;
      const col = document.createElement('span');
      col.className = 'd-col';
      const total = 10 + n + 1;
      for (let k = 0; k < total; k++) { const s = document.createElement('span'); s.textContent = k % 10; col.appendChild(s); }
      d.appendChild(col);
      cols.push({ col, total });
    } else {
      d.textContent = ch;
      d.style.lineHeight = '.95';
    }
    el.appendChild(d);
  });
  return cols;
}

if (!REDUCED) {
  const odoCols = $$('.meter__num[data-odo]').map((el) => buildOdometer(el));
  const inf = $('.meter__num--inf .inf');
  inf.textContent = '8';
  ScrollTrigger.create({
    trigger: '.meter__list', start: 'top 82%', once: true,
    onEnter: () => {
      odoCols.forEach((cols, i) => cols.forEach(({ col, total }, k) => {
        gsap.fromTo(col, { yPercent: 0 }, { yPercent: -((total - 1) / total) * 100, duration: 2.2 + k * 0.25, ease: 'expo.inOut', delay: i * 0.12 });
      }));
      gsap.timeline({ delay: 0.5 })
        .to(inf, { rotate: 90, duration: 1.1, ease: 'expo.inOut' })
        .add(() => { inf.textContent = '∞'; gsap.set(inf, { rotate: 0 }); });
    },
  });
  gsap.fromTo('.meter__needle', { left: '0%' }, {
    left: '50%', ease: 'power2.out',
    scrollTrigger: { trigger: '.meter', start: 'top 85%', end: 'center 50%', scrub: 1 },
  });
} else {
  gsap.set('.meter__needle', { left: '50%' });
}

/* ── 03 · Darkroom: horizontal walk past hanging prints ── */
const dark = {
  section: $('#darkroom'), pin: $('.darkroom__pin'), track: $('.darkroom__track'),
  line: $('.darkroom__line'), path: $('.darkroom__line path'),
  prints: $$('.print').map((el) => ({ el, x: 0, y: 0, w: 0, angle: 0, av: 0, dev: 0, latched: 0, k: 0.035 + Math.random() * 0.02 })),
  active: false, tween: null,
};

function cacheDarkroom() {
  const W = dark.track.scrollWidth, H = dark.track.offsetHeight;
  dark.line.setAttribute('viewBox', `0 0 ${W} ${H}`);
  dark.prints.forEach((p) => {
    p.x = p.el.offsetLeft + p.el.offsetWidth / 2;
    p.y = p.el.offsetTop - 6;
    p.w = p.el.offsetWidth;
  });
  dark.W = W; dark.H = H;
}

if (!REDUCED) {
  const dist = () => Math.max(0, dark.track.scrollWidth - innerWidth);
  dark.tween = gsap.to(dark.track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: {
      trigger: dark.section, start: 'top top', end: () => '+=' + dist(), pin: dark.pin, scrub: 0.9, invalidateOnRefresh: true,
      onToggle: (self) => { dark.active = self.isActive; },
      onUpdate: (self) => gsap.set('.darkroom__progress i', { scaleX: self.progress }),
    },
  });
  ScrollTrigger.addEventListener('refreshInit', () => gsap.set(dark.track, { x: 0 }));
  ScrollTrigger.addEventListener('refresh', cacheDarkroom);

  // lights go out, then the safelight stutters on
  gsap.set('.darkroom__lights', { opacity: 0.94 });
  ScrollTrigger.create({
    trigger: dark.section, start: 'top 65%', once: true,
    onEnter: () => {
      gsap.timeline()
        .to('.darkroom__lights', { opacity: 0.2, duration: 0.06 })
        .to('.darkroom__lights', { opacity: 0.85, duration: 0.05 }, '+=0.08')
        .add(() => sound.tick(0.3))
        .to('.darkroom__lights', { opacity: 0.05, duration: 0.05 }, '+=0.12')
        .to('.darkroom__lights', { opacity: 0.6, duration: 0.04 }, '+=0.05')
        .to('.darkroom__lights', { opacity: 0, duration: 0.8, ease: 'power2.out' }, '+=0.06');
    },
  });

  // physics: prints sway with scroll velocity, the line sags & wobbles, images develop near centre
  let wob = 0;
  gsap.ticker.add((time, delta) => {
    const inView = dark.active || ScrollTrigger.isInViewport(dark.section, 0.01);
    if (!inView || !dark.W) return;
    const dt = Math.min(delta / 16.67, 3);
    const vel = dark.tween.scrollTrigger.getVelocity();
    const tx = gsap.getProperty(dark.track, 'x');
    const vw = innerWidth;
    const target = clamp(-vel / 160, -16, 16);
    wob += (Math.abs(vel) / 3000 - wob) * 0.05;

    let d = `M0 ${dark.prints[0].y - 40}`;
    let prevX = 0, prevY = dark.prints[0].y - 40;
    dark.prints.forEach((p, i) => {
      // damped spring
      p.av += (target - p.angle) * p.k * dt;
      p.av *= Math.pow(0.9, dt);
      p.angle += p.av * dt;
      p.el.style.transform = `rotate(${p.angle.toFixed(2)}deg)`;

      // development: latch the maximum exposure, chemistry catches up slowly
      const cx = tx + p.x;
      const near = 1 - clamp(Math.abs(cx - vw * 0.55) / (vw * 0.55), 0, 1);
      p.latched = Math.max(p.latched, clamp(near * 1.6, 0, 1));
      const nd = p.dev + (p.latched - p.dev) * 0.025 * dt;
      if (Math.abs(nd - p.dev) > 0.001) { p.dev = nd; p.el.style.setProperty('--dev', nd.toFixed(3)); }

      // clothesline segment
      const sag = 26 + wob * 40 + Math.sin(time * 3 + i) * wob * 14;
      const mx = (prevX + p.x) / 2, my = Math.max(prevY, p.y) + sag;
      d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      prevX = p.x; prevY = p.y;
    });
    const endX = dark.W, endY = dark.prints[dark.prints.length - 1].y - 30;
    d += ` Q${((prevX + endX) / 2).toFixed(1)} ${(Math.max(prevY, endY) + 40).toFixed(1)} ${endX} ${endY}`;
    dark.path.setAttribute('d', d);
  });
} else {
  dark.prints.forEach((p) => p.el.style.setProperty('--dev', 1));
}

/* ── Lightbox: inspect a print under white light ── */
const lb = { root: $('.lightbox'), img: $('.lightbox__img'), cap: $('.lightbox__cap'), close: $('.lightbox__close'), from: null, opener: null };
function openLightbox(btn) {
  const small = btn.querySelector('img');
  lb.opener = btn;
  lb.from = small;
  lb.img.src = small.currentSrc || small.src;
  lb.img.alt = small.alt;
  lb.cap.textContent = btn.closest('figure').querySelector('figcaption').textContent.replace(/\s+/g, ' ').trim();
  lb.root.hidden = false;
  lenis?.stop();
  const full = new Image();
  full.onload = () => { lb.img.src = full.src; };
  full.src = btn.dataset.full;

  const a = small.getBoundingClientRect();
  const b = lb.img.getBoundingClientRect();
  if (!REDUCED) {
    gsap.fromTo(lb.img,
      { x: a.left + a.width / 2 - (b.left + b.width / 2), y: a.top + a.height / 2 - (b.top + b.height / 2), scaleX: a.width / b.width, scaleY: a.height / b.height },
      { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 1, ease: 'expo.inOut' });
    gsap.fromTo('.lightbox__bg', { opacity: 0 }, { opacity: 1, duration: 0.6 });
    gsap.fromTo(['.lightbox__cap', '.lightbox__close'], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6, delay: 0.7 });
  }
  lb.close.focus({ preventScroll: true });
}
function closeLightbox() {
  if (lb.root.hidden) return;
  const done = () => { lb.root.hidden = true; lenis?.start(); lb.opener?.focus({ preventScroll: true }); };
  if (REDUCED) return done();
  const a = lb.from.getBoundingClientRect();
  const b = lb.img.getBoundingClientRect();
  gsap.to(['.lightbox__cap', '.lightbox__close'], { autoAlpha: 0, duration: 0.2 });
  gsap.to('.lightbox__bg', { opacity: 0, duration: 0.6, delay: 0.3 });
  gsap.to(lb.img, {
    x: a.left + a.width / 2 - (b.left + b.width / 2), y: a.top + a.height / 2 - (b.top + b.height / 2),
    scaleX: a.width / b.width, scaleY: a.height / b.height, duration: 0.85, ease: 'expo.inOut', onComplete: done,
  });
}
$$('.print__paper').forEach((btn) => btn.addEventListener('click', () => openLightbox(btn)));
lb.close.addEventListener('click', closeLightbox);
$('.lightbox__bg').addEventListener('click', closeLightbox);

/* ── 04 · Exposure ── */
const expChars = splitChars($('.exposure__title'));
if (!REDUCED) {
  // light leak burns across the cut from the red darkroom to bright paper
  gsap.timeline({ scrollTrigger: { trigger: '#exposure', start: 'top 95%', end: 'top 5%', scrub: 0.5 } })
    .fromTo('.leak', { opacity: 0 }, { opacity: 0.95, duration: 0.45, ease: 'power2.in' })
    .to('.leak', { opacity: 0, duration: 0.55, ease: 'power2.out' })
    .fromTo('.leak i', { xPercent: -40 }, { xPercent: 50, duration: 1, ease: 'none', stagger: 0.04 }, 0);

  gsap.set(expChars, { yPercent: 120, rotate: 10, transformOrigin: '0% 100%' });
  ScrollTrigger.create({
    trigger: '.exposure__title', start: 'top 78%', once: true,
    onEnter: () => gsap.to(expChars, { yPercent: 0, rotate: 0, duration: 1.3, ease: 'expo.out', stagger: 0.018 }),
  });
  gsap.fromTo('.exposure__ghost', { yPercent: -15 }, { yPercent: 35, ease: 'none', scrollTrigger: { trigger: '#exposure', start: 'top bottom', end: 'bottom top', scrub: true } });

  ScrollTrigger.batch('.svc__row', {
    start: 'top 90%', once: true,
    onEnter: (batch) => {
      gsap.to(batch, { '--ls': 1, duration: 1.4, ease: 'expo.out', stagger: 0.1 });
      gsap.fromTo(batch.map((r) => r.querySelector('.svc__roll')), { yPercent: 105 }, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, clearProps: 'transform' });
      gsap.fromTo(batch.map((r) => [r.querySelector('.svc__no'), r.querySelector('.svc__tag')]).flat(), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.05, delay: 0.2, clearProps: 'transform' });
    },
  });
} else {
  $$('.svc__row').forEach((r) => r.style.setProperty('--ls', 1));
}
// touch devices: the row nearest the centre of the screen “exposes” itself
if (!env.finePointer) {
  $$('.svc__row').forEach((row) => ScrollTrigger.create({ trigger: row, start: 'top 58%', end: 'bottom 42%', toggleClass: 'is-active' }));
}

/* ── 05 · Projection ── */
if (!REDUCED) {
  gsap.fromTo('.projection__beam', { scaleX: 0.08, opacity: 0 }, {
    scaleX: 1, opacity: 1, ease: 'power2.out',
    scrollTrigger: { trigger: '#projection', start: 'top 85%', end: 'top 0%', scrub: 0.8 },
  });
  gsap.fromTo('.projection__title', { letterSpacing: '0.35em', opacity: 0, filter: 'blur(10px)' }, {
    letterSpacing: '-0.03em', opacity: 1, filter: 'blur(0px)', ease: 'power3.out',
    scrollTrigger: { trigger: '.projection__title', start: 'top 90%', end: 'top 45%', scrub: 0.8 },
  });
  $$('.screen').forEach((scr) => {
    const glass = scr.querySelector('.screen__glass');
    gsap.set(glass, { scaleX: 0, scaleY: 0.006, filter: 'brightness(4)' });
    gsap.set(scr.querySelector('.screen__meta'), { autoAlpha: 0, y: 20 });
    ScrollTrigger.create({
      trigger: scr, start: 'top 78%', once: true,
      onEnter: () => {
        gsap.timeline()
          .to(glass, { scaleX: 1, duration: 0.55, ease: 'expo.out' })
          .to(glass, { scaleY: 1, duration: 0.7, ease: 'expo.inOut' })
          .to(glass, { filter: 'brightness(0.4)', duration: 0.05 })
          .to(glass, { filter: 'brightness(1.6)', duration: 0.05 })
          .to(glass, { filter: 'brightness(1)', duration: 0.6, clearProps: 'filter' })
          .to(scr.querySelector('.screen__meta'), { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out' }, '-=0.6');
      },
    });
  });
  mm.add('(min-width: 769px)', () => {
    gsap.fromTo('.screen--b', { y: 80 }, { y: -80, ease: 'none', scrollTrigger: { trigger: '.screens', start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

/* ── Video modal ── */
const vm = { root: $('.vmodal'), frame: $('.vmodal__frame'), close: $('.vmodal__close'), opener: null };
function openVideo(btn) {
  vm.opener = btn;
  vm.frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${btn.dataset.yt}?autoplay=1&rel=0&modestbranding=1" title="${btn.getAttribute('aria-label')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  vm.root.hidden = false;
  lenis?.stop();
  if (!REDUCED) {
    gsap.fromTo('.vmodal__bg', { opacity: 0 }, { opacity: 1, duration: 0.5 });
    gsap.fromTo(vm.frame, { scaleX: 0, scaleY: 0.01 }, { keyframes: [{ scaleX: 1, duration: 0.45, ease: 'expo.out' }, { scaleY: 1, duration: 0.6, ease: 'expo.inOut' }] });
  }
  vm.close.focus({ preventScroll: true });
}
function closeVideo() {
  if (vm.root.hidden) return;
  const done = () => { vm.frame.innerHTML = ''; vm.root.hidden = true; lenis?.start(); vm.opener?.focus({ preventScroll: true }); };
  if (REDUCED) return done();
  gsap.timeline({ onComplete: done })
    .to(vm.frame, { scaleY: 0.01, duration: 0.4, ease: 'expo.in' })
    .to(vm.frame, { scaleX: 0, duration: 0.3, ease: 'expo.in' })
    .to('.vmodal__bg', { opacity: 0, duration: 0.3 }, '-=0.2');
}
$$('.screen').forEach((b) => b.addEventListener('click', () => openVideo(b)));
vm.close.addEventListener('click', closeVideo);
$('.vmodal__bg').addEventListener('click', closeVideo);

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeLightbox(); closeVideo(); }
  // simple focus trap for the dialogs
  if (e.key === 'Tab') {
    const open = !lb.root.hidden ? lb.root : !vm.root.hidden ? vm.root : null;
    if (open) { e.preventDefault(); open.querySelector('button').focus(); }
  }
});

/* ── 06 · Rana: the iris closes around the shutter ── */
const closeIris = createAperture($('.close__iris'), { blades: 9 });
const IRIS_START = 104; // blades already visible at the frame edges as the scene arrives
const irisState = { r: IRIS_START };
const irisClosedR = () => closeIris.pxToUnits(innerWidth <= 768 ? 96 : 118);
closeIris.draw(IRIS_START);

if (!REDUCED) {
  const lines = $$('.close__line');
  const tl = gsap.timeline({
    scrollTrigger: { trigger: '#close', start: 'top top', end: '+=120%', pin: '.close__pin', scrub: 0.8, invalidateOnRefresh: true },
  });
  tl.fromTo(irisState, { r: IRIS_START }, { r: () => irisClosedR(), ease: 'power2.inOut', duration: 1, onUpdate: () => closeIris.draw(irisState.r) }, 0)
    .fromTo('.close__light', { scale: 1.25 }, { scale: 1, duration: 1, ease: 'none' }, 0)
    .fromTo(lines, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: 0.12, duration: 0.45, ease: 'power3.out' }, 0.25)
    .fromTo('.shutter', { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.3 }, 0.6)
    .fromTo('.close__hint', { autoAlpha: 0 }, { autoAlpha: 0.85, duration: 0.3 }, 0.68)
    .fromTo('.contact li', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.08 }, 0.7);
} else {
  ScrollTrigger.addEventListener('refresh', () => { irisState.r = irisClosedR(); closeIris.draw(irisState.r); });
}

/* Hold-to-shoot shutter — the final interaction */
const shutter = {
  btn: $('.shutter'), prog: $('.shutter__prog'), msg: $('.close__captured'),
  C: 351.86, tween: null, stopCharge: null, busy: false, shots: 0, holding: false,
};
function holdStart(e) {
  if (shutter.busy || shutter.holding) return;
  if (e?.type === 'pointerdown') { shutter.btn.setPointerCapture?.(e.pointerId); }
  shutter.holding = true;
  shutter.btn.classList.add('is-holding');
  shutter.stopCharge = sound.charge(0.9);
  shutter.tween = gsap.to(shutter.prog, { strokeDashoffset: 0, duration: 0.9, ease: 'power1.in', onComplete: fire });
}
function holdCancel() {
  if (!shutter.holding || shutter.busy) return;
  shutter.holding = false;
  shutter.tween?.kill();
  shutter.stopCharge?.();
  shutter.btn.classList.remove('is-holding');
  gsap.to(shutter.prog, { strokeDashoffset: shutter.C, duration: 0.5, ease: 'power2.out' });
}
function fire() {
  shutter.busy = true;
  shutter.holding = false;
  shutter.stopCharge?.();
  sound.shutter();
  shutter.shots += 1;
  gsap.timeline().set('.flash', { opacity: REDUCED ? 0.35 : 1 }).to('.flash', { opacity: 0, duration: REDUCED ? 0.6 : 1.3, ease: 'power2.out' });
  if (!REDUCED) {
    const resting = irisState.r;
    const blink = { r: resting };
    gsap.timeline()
      .to(blink, { r: 0, duration: 0.07, ease: 'power2.in', onUpdate: () => closeIris.draw(blink.r) })
      .to(blink, { r: resting, duration: 0.45, ease: 'expo.out', onUpdate: () => closeIris.draw(blink.r) }, '+=0.06');
    gsap.fromTo('.close__light', { filter: 'brightness(2.2)' }, { filter: 'brightness(1)', duration: 1.6, ease: 'power2.out', clearProps: 'filter' });
  }
  const n = String(36 + shutter.shots).padStart(2, '0');
  shutter.msg.textContent = `Frame ${n} tersimpan — kini giliran momenmu ↓`;
  gsap.fromTo(shutter.msg, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', delay: 0.4 });
  gsap.fromTo('.contact li:first-child a', { scale: 1 }, { scale: 1.08, yoyo: true, repeat: 3, duration: 0.25, delay: 0.6, ease: 'power1.inOut' });
  gsap.to(shutter.prog, { strokeDashoffset: shutter.C, duration: 0.8, delay: 0.5, ease: 'power2.inOut', onComplete: () => { shutter.busy = false; shutter.btn.classList.remove('is-holding'); } });
}
shutter.btn.addEventListener('pointerdown', holdStart);
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => shutter.btn.addEventListener(ev, holdCancel));
shutter.btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); holdStart(); } });
shutter.btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') holdCancel(); });
shutter.btn.addEventListener('contextmenu', (e) => e.preventDefault());

/* ── Footer: rewind the film ── */
$('.foot__rewind').addEventListener('click', () => {
  hud.chapter.textContent = 'Gulung balik';
  sound.tick(0.2);
  scrollToTarget(0, 3.4);
  $('#latent').setAttribute('tabindex', '-1');
  $('#latent').focus({ preventScroll: true });
});

/* ── Motion toggle (full by default, opt-in reduced mode) ── */
const motBtn = $('.hud__motion');
if (motBtn) {
  motBtn.setAttribute('aria-pressed', String(!REDUCED));
  motBtn.querySelector('.hud__motion-label').textContent = REDUCED ? 'Mode tenang' : 'Gerak penuh';
  motBtn.addEventListener('click', () => {
    const next = REDUCED ? 'full' : 'reduced';
    try { localStorage.setItem('motion', next); } catch (e) {}
    const url = new URL(location.href);
    url.searchParams.delete('motion');
    location.href = url.toString();
  });
}

/* ── Sound toggle ── */
const sndBtn = $('.hud__sound');
sndBtn.addEventListener('click', () => {
  const on = sound.toggle();
  sndBtn.setAttribute('aria-pressed', String(on));
  sndBtn.querySelector('.hud__sound-label').textContent = on ? 'Suara nyala' : 'Suara mati';
  if (on) sound.tick(0.3);
});

/* ── Cursor (fine pointers only) ── */
if (env.finePointer) initCursor();

/* ── Keep measurements honest once everything has loaded ── */
/* -- Chapter tracking: created last so every pin above is already measured -- */
$$('main > section[data-chapter]').forEach((sec, i) => {
  ScrollTrigger.create({
    trigger: sec, start: 'top 55%', end: 'bottom 55%',
    onToggle: (self) => self.isActive && setChapter(i, sec),
  });
});
setChapter(0, $('#latent'));

const refreshWhenReady = () => { if (!document.body.classList.contains('is-loading')) ScrollTrigger.refresh(); };
window.addEventListener('load', refreshWhenReady);
document.fonts?.ready.then(refreshWhenReady);
