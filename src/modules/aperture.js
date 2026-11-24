// A procedurally drawn camera iris.
// The opening is a regular N-gon (inradius r). Each blade is the quad between two
// consecutive polygon edges extended outward — so the blades tile everything outside
// the opening, and their seams spiral exactly like a real lens diaphragm.

const NS = 'http://www.w3.org/2000/svg';

export function createAperture(svg, { blades = 9, open = 150, tone = ['#1b1714', '#0c0a09'] } = {}) {
  const defs = document.createElementNS(NS, 'defs');
  const uid = Math.random().toString(36).slice(2, 7);
  // two alternating metallic gradients so neighbouring blades read as separate plates
  const grads = [0, 1].map((k) => {
    const g = document.createElementNS(NS, 'linearGradient');
    g.id = `ap-${uid}-${k}`;
    g.setAttribute('gradientUnits', 'userSpaceOnUse');
    g.setAttribute('x1', '-120'); g.setAttribute('y1', k ? '-120' : '120');
    g.setAttribute('x2', '120'); g.setAttribute('y2', k ? '120' : '-120');
    [[0, tone[0]], [0.55, tone[1]], [1, k ? '#221d19' : '#161210']].forEach(([o, c]) => {
      const s = document.createElementNS(NS, 'stop');
      s.setAttribute('offset', o); s.setAttribute('stop-color', c);
      g.appendChild(s);
    });
    defs.appendChild(g);
    return g.id;
  });
  svg.appendChild(defs);

  const paths = Array.from({ length: blades }, (_, i) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', 'blade');
    p.setAttribute('fill', `url(#${grads[i % 2]})`);
    svg.appendChild(p);
    return p;
  });

  const state = { r: 0, open };
  const L = 520; // blade length — well past the viewBox

  function draw(r) {
    state.r = r;
    const t = Math.min(1, r / open);
    const rot = -1.2 + (1 - t) * 1.05; // blades twist as they close
    const step = (Math.PI * 2) / blades;
    const R = r / Math.cos(Math.PI / blades); // circumradius
    const v = [];
    for (let i = 0; i < blades; i++) {
      const a = rot + i * step;
      v.push([Math.cos(a) * R, Math.sin(a) * R]);
    }
    const dir = (i) => {
      const a = v[i % blades], b = v[(i + 1) % blades];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) { // fully closed: use tangent of the regular polygon
        const ang = rot + i * step + Math.PI / 2 + step / 2;
        return [Math.cos(ang), Math.sin(ang)];
      }
      return [dx / len, dy / len];
    };
    for (let k = 0; k < blades; k++) {
      const p1 = v[(k + 1) % blades];
      const p2 = v[(k + 2) % blades];
      const d1 = dir(k), d2 = dir(k + 1);
      const q1 = [p1[0] + d1[0] * L, p1[1] + d1[1] * L];
      const q2 = [p2[0] + d2[0] * L, p2[1] + d2[1] * L];
      paths[k].setAttribute('d',
        `M${p1[0].toFixed(2)} ${p1[1].toFixed(2)}L${q1[0].toFixed(2)} ${q1[1].toFixed(2)}L${q2[0].toFixed(2)} ${q2[1].toFixed(2)}L${p2[0].toFixed(2)} ${p2[1].toFixed(2)}Z`);
    }
  }

  /** px radius on screen → viewBox units (viewBox is 200 wide, `slice` maps it to vmax) */
  function pxToUnits(px) {
    const vmax = Math.max(svg.clientWidth || innerWidth, svg.clientHeight || innerHeight);
    return (px / vmax) * 200;
  }

  draw(0);
  return { draw, state, pxToUnits, svg };
}
