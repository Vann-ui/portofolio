// Focus-bracket cursor. It locks onto interactive elements like autofocus points
// locking onto a subject, and carries a one-word label.
import { gsap } from 'gsap';
import { $, $$ } from './utils.js';

export function initCursor() {
  const root = $('.cursor');
  const box = $('.cursor__box', root);
  const dot = $('.cursor__dot', root);
  const label = $('.cursor__label', root);
  document.documentElement.classList.add('has-cursor');

  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const b = { x: pos.x, y: pos.y, w: 34, h: 34 };
  let target = null;
  let visible = false;

  window.addEventListener('pointermove', (e) => {
    pos.x = e.clientX; pos.y = e.clientY;
    if (!visible) { visible = true; gsap.to(root, { autoAlpha: 1, duration: 0.3 }); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { visible = false; gsap.to(root, { autoAlpha: 0, duration: 0.3 }); });
  window.addEventListener('pointerdown', () => root.classList.add('is-down'));
  window.addEventListener('pointerup', () => root.classList.remove('is-down'));

  gsap.set(root, { autoAlpha: 0 });
  let inHero = false;
  const setTarget = (el) => {
    target = el;
    const txt = el?.dataset.cursor || (inHero ? 'Cuci' : '');
    label.textContent = txt;
    root.classList.toggle('has-label', !!txt);
  };
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-cursor]');
    if (el !== target) setTarget(el);
  });

  // contextual label over the developing hero image
  const hero = $('.latent__stage');
  hero?.addEventListener('pointerenter', () => { inHero = true; setTarget(target); });
  hero?.addEventListener('pointerleave', () => { inHero = false; setTarget(target); });

  gsap.ticker.add(() => {
    let tx, ty, tw, th;
    if (target && target.isConnected) {
      const r = target.getBoundingClientRect();
      const pad = 10;
      // brackets wrap the subject but lean slightly towards the pointer (magnetic)
      tw = r.width + pad * 2; th = r.height + pad * 2;
      tx = r.left - pad + (pos.x - (r.left + r.width / 2)) * 0.08;
      ty = r.top - pad + (pos.y - (r.top + r.height / 2)) * 0.08;
      if (tw > innerWidth * 0.6 || th > innerHeight * 0.5) { // huge targets: keep the small reticle
        tw = th = 54; tx = pos.x - 27; ty = pos.y - 27;
      }
    } else {
      tw = th = 34; tx = pos.x - 17; ty = pos.y - 17;
    }
    b.x += (tx - b.x) * 0.22; b.y += (ty - b.y) * 0.22;
    b.w += (tw - b.w) * 0.2; b.h += (th - b.h) * 0.2;
    box.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
    box.style.width = `${b.w}px`;
    box.style.height = `${b.h}px`;
    dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    label.style.transform = `translate3d(${b.x + b.w + 8}px, ${b.y + b.h - 6}px, 0)`;
  });

  // magnetic elements drift towards the pointer
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}
