// Shared helpers & environment flags

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mapRange = (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c);

// Motion preference: OS setting by default; `?motion=full|reduced` overrides (remembered).
const motionParam = new URLSearchParams(location.search).get('motion');
if (motionParam === 'full' || motionParam === 'reduced') { try { localStorage.setItem('motion', motionParam); } catch (e) {} }
let motionPref = null;
try { motionPref = localStorage.getItem('motion'); } catch (e) {}

export const env = {
  reduced: motionPref ? motionPref === 'reduced' : window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  finePointer: window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  get mobile() { return window.innerWidth < 769; },
};

/** Wrap every word in <span class="w"> while preserving inline elements (em, b…). */
export function splitWords(root) {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(' '));
          else {
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = p;
            frag.appendChild(s);
          }
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
    });
  };
  walk(root);
  return [...root.querySelectorAll('.w')];
}

/** Split text into chars (grouped by words so lines wrap naturally). Marks pieces aria-hidden. */
export function splitChars(root) {
  const chars = [];
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((word) => {
          if (!word) return;
          if (/^\s+$/.test(word)) { frag.appendChild(document.createTextNode(' ')); return; }
          const wd = document.createElement('span');
          wd.className = 'wd';
          wd.setAttribute('aria-hidden', 'true');
          [...word].forEach((c) => {
            const s = document.createElement('span');
            s.className = 'ch';
            s.textContent = c;
            wd.appendChild(s);
            chars.push(s);
          });
          frag.appendChild(wd);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
    });
  };
  walk(root);
  return chars;
}

/** Generates a tiny tileable noise texture at runtime (no asset needed). */
export function makeGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 180;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}
