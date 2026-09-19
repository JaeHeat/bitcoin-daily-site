/*
 * Minimal SVG line-chart helper for the Runfi model page.
 * Thin marks, recessive grid, crosshair + tooltip, direct end-labels, and a
 * legend whenever there is more than one series, so identity is never
 * carried by colour alone.
 */

const NS = 'http://www.w3.org/2000/svg';
const el = (n, attrs = {}) => {
  const e = document.createElementNS(NS, n);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

export const fmtUsd = (v) => {
  const a = Math.abs(v);
  if (a < 1e-9) return '$0';
  if (a >= 1e9) return `${v < 0 ? '-' : ''}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${v < 0 ? '-' : ''}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${v < 0 ? '-' : ''}$${(a / 1e3).toFixed(0)}k`;
  if (a >= 10) return `${v < 0 ? '-' : ''}$${a.toFixed(0)}`;
  if (a >= 0.01) return `${v < 0 ? '-' : ''}$${a.toFixed(2)}`;
  return `${v < 0 ? '-' : ''}$${a.toFixed(4)}`;
};
export const fmtNum = (v) =>
  Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(2)}M`
    : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(1)}k`
      : v.toFixed(0);

/**
 * series: [{ name, colorVar, values: number[] }]
 * opts:   { log, format, yTitle }
 */
export function lineChart(host, series, opts = {}) {
  const { log = false, format = fmtUsd, yTitle = '' } = opts;
  const W = 720, H = 300;
  const M = { t: 16, r: 74, b: 34, l: 62 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const n = series[0].values.length;

  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  const floor = log ? Math.max(1e-4, Math.min(...all.filter((v) => v > 0))) : 0;
  let lo = log ? floor : Math.min(0, ...all);
  let hi = Math.max(...all);
  if (hi === lo) hi = lo + 1;
  if (!log) hi *= 1.08;

  const sx = (i) => M.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const sy = (v) => {
    if (!Number.isFinite(v)) return null;
    const t = log
      ? (Math.log10(Math.max(v, floor)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))
      : (v - lo) / (hi - lo);
    return M.t + ih - t * ih;
  };

  host.innerHTML = '';
  const svg = el('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img',
    'aria-label': `${yTitle || 'chart'}: ${series.map((s) => s.name).join(', ')} over ${n} months`,
  });

  // --- gridlines + y axis (recessive) ---
  let ticks = [];
  if (log) {
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) ticks.push(10 ** e);
    // Drop decades outside the data range: without this the sub-floor ticks all
    // clamp to the baseline and their labels stack on top of each other.
    ticks = ticks.filter((t) => t >= lo * 0.999 && t <= hi * 1.001);
  } else {
    for (let i = 0; i <= 4; i++) ticks.push(lo + ((hi - lo) * i) / 4);
  }
  for (const t of ticks) {
    const y = sy(t);
    if (y == null || y < M.t - 1 || y > M.t + ih + 1) continue;
    svg.appendChild(el('line', { x1: M.l, x2: M.l + iw, y1: y, y2: y, class: 'grid' }));
    const lab = el('text', { x: M.l - 8, y: y + 4, class: 'axis-label', 'text-anchor': 'end' });
    lab.textContent = format(t);
    svg.appendChild(lab);
  }
  // zero line gets a touch more presence when the scale crosses it
  if (!log && lo < 0 && hi > 0) {
    svg.appendChild(el('line', { x1: M.l, x2: M.l + iw, y1: sy(0), y2: sy(0), class: 'grid-zero' }));
  }

  // --- x axis ---
  for (let i = 0; i < n; i++) {
    if (i !== 0 && i !== n - 1 && (i + 1) % 6 !== 0) continue;
    const t = el('text', { x: sx(i), y: H - 12, class: 'axis-label', 'text-anchor': 'middle' });
    t.textContent = `m${i + 1}`;
    svg.appendChild(t);
  }

  // --- series ---
  series.forEach((s) => {
    const pts = s.values.map((v, i) => [sx(i), sy(v)]).filter(([, y]) => y != null);
    if (!pts.length) return;
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    svg.appendChild(el('path', { d, class: 'series', stroke: `var(${s.colorVar})` }));
    // Direct end-label: secondary encoding so identity never rests on colour.
    const [lx, ly] = pts[pts.length - 1];
    const lab = el('text', {
      x: Math.min(lx + 8, W - 4), y: Math.max(12, Math.min(ly + 4, H - 4)),
      class: 'series-label',
    });
    lab.textContent = s.name;
    svg.appendChild(lab);
  });

  // --- hover layer ---
  const cross = el('line', { class: 'crosshair', y1: M.t, y2: M.t + ih, opacity: 0 });
  svg.appendChild(cross);
  const dots = series.map((s) => {
    const c = el('circle', { r: 4.5, class: 'hover-dot', fill: `var(${s.colorVar})`, opacity: 0 });
    svg.appendChild(c);
    return c;
  });

  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  host.style.position = 'relative';
  host.appendChild(svg);
  host.appendChild(tip);

  const hit = el('rect', { x: M.l, y: M.t, width: iw, height: ih, fill: 'transparent' });
  svg.appendChild(hit);

  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX ?? ev.touches?.[0]?.clientX) - r.left) * (W / r.width);
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - M.l) / iw) * (n - 1))));
    const x = sx(i);
    cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('opacity', 1);
    series.forEach((s, k) => {
      const y = sy(s.values[i]);
      if (y == null) { dots[k].setAttribute('opacity', 0); return; }
      dots[k].setAttribute('cx', x); dots[k].setAttribute('cy', y); dots[k].setAttribute('opacity', 1);
    });
    tip.hidden = false;
    tip.innerHTML = `<strong>Month ${i + 1}</strong>` + series.map((s) =>
      `<span><i style="background:var(${s.colorVar})"></i>${s.name}<b>${
        Number.isFinite(s.values[i]) ? format(s.values[i]) : '-'}</b></span>`).join('');
    const left = (x / W) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 8), r.width - 8)}px`;
  };
  const leave = () => {
    cross.setAttribute('opacity', 0);
    dots.forEach((d) => d.setAttribute('opacity', 0));
    tip.hidden = true;
  };
  svg.addEventListener('mousemove', move);
  svg.addEventListener('touchmove', (e) => { move(e); e.preventDefault(); }, { passive: false });
  svg.addEventListener('mouseleave', leave);
  svg.addEventListener('touchend', leave);

  // --- legend (always present for 2+ series) ---
  if (series.length > 1) {
    const leg = document.createElement('div');
    leg.className = 'legend';
    leg.innerHTML = series.map((s) =>
      `<span><i style="background:var(${s.colorVar})"></i>${s.name}</span>`).join('');
    host.appendChild(leg);
  }
}

/** Accessible table fallback for any chart. */
export function dataTable(host, series, format = fmtUsd) {
  const n = series[0].values.length;
  const rows = Array.from({ length: n }, (_, i) =>
    `<tr><th scope="row">m${i + 1}</th>${series.map((s) =>
      `<td>${Number.isFinite(s.values[i]) ? format(s.values[i]) : '-'}</td>`).join('')}</tr>`).join('');
  host.innerHTML = `<table><thead><tr><th scope="col">Month</th>${
    series.map((s) => `<th scope="col">${s.name}</th>`).join('')
  }</tr></thead><tbody>${rows}</tbody></table>`;
}
