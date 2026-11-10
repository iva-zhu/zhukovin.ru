(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BPMLib = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // q — длина в четвертях (1/4 = 1)
  const NOTES = [
    { label: '1/1', q: 4 },
    { label: '1/2', q: 2 },
    { label: '1/4', q: 1 },
    { label: '1/8', q: 0.5 },
    { label: '1/16', q: 0.25 },
    { label: '1/32', q: 0.125 },
    { label: '1/64', q: 0.0625 },
    { label: '1/128', q: 0.03125 }
  ];

  const MODS = [
    { key: 'straight', mul: 1 },
    { key: 'dotted', mul: 1.5 },
    { key: 'triplet', mul: 2 / 3 }
  ];

  const qMs = (q, bpm) => q * 60000 / bpm;

  // размер такта: "6/8" → 3 четверти, "7/8" → 3.5; число → столько четвертей
  const barQ = sig => {
    if (typeof sig === 'number') return sig;
    const [n, d] = String(sig).split('/').map(Number);
    return (n || 4) * 4 / (d || 4);
  };
  const barMs = (bpm, sig) => qMs(barQ(sig), bpm);

  const fmtMs = v => v.toFixed(v >= 1000 ? 1 : 2);
  const fmtS = v => (v / 1000).toFixed(v >= 10000 ? 2 : 3);
  const fmtHz = v => v >= 100 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v.toFixed(3);

  return { NOTES, MODS, qMs, barQ, barMs, fmtMs, fmtS, fmtHz };
});
