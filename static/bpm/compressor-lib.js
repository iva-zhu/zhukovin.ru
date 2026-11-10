(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CompLib = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // q — длина в четвертях (1/4 = 1). Доли длиннее 1/4 записываются как 0.5, 2 и т.д.
  const qMs = (q, bpm) => q * 60000 / bpm;

  // sig — строка вида "4/4", "6/8". Такт в четвертях: n * 4 / d.
  const barQ = sig => {
    const [n, d] = String(sig).split('/').map(Number);
    return (n || 4) * 4 / (d || 4);
  };
  const barMs = (bpm, sig) => qMs(barQ(sig), bpm);

  const Q_LABEL = {
    4: '1/1', 2: '1/2', 1: '1/4', 0.5: '1/8', 0.25: '1/16',
    0.125: '1/32', 0.0625: '1/64', 0.03125: '1/128', 0.015625: '1/256'
  };
  const noteLabel = q => Q_LABEL[q] || `1/${Math.round(4 / q)}`;

  // Округляем release к ближайшей музыкальной длительности (по логарифму).
  const Q_STEPS = [0.015625, 0.03125, 0.0625, 0.125, 0.25, 0.5, 1, 2, 4];
  function nearestQ(q) {
    let best = Q_STEPS[0], bestD = Infinity;
    for (const s of Q_STEPS) {
      const d = Math.abs(Math.log2(q / s));
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  // ---------- источники ----------
  // attack — абсолютные мс (не ноты). release — доля, пересчитывается от BPM.
  const GROUPS = [
    {
      id: 'kick', ru: 'Кик', en: 'Kick',
      atk: 8, relQ: 0.5, ratio: 3.5, thr: [-18, -12], knee: 4,
      why: {
        ru: '5–15 мс сохраняют щелчок; release 1/8 держит тело. Больше 4 дБ GR — бочка теряет низ.',
        en: '5–15 ms keeps the beater click; a 1/8 release holds the body. Above 4 dB GR the kick loses weight.'
      }
    },
    {
      id: 'snare', ru: 'Малый / клэп', en: 'Snare / clap',
      atk: 5, relQ: 0.5, ratio: 3.5, thr: [-18, -10], knee: 4,
      why: {
        ru: '3–8 мс сохраняют атаку; следи за хвостом — иначе малый станет сухим и коротким.',
        en: '3–8 ms preserves the snap; watch the tail or the snare turns short and dry.'
      }
    },
    {
      id: 'hats', ru: 'Хэты / перк', en: 'Hats / perc',
      atk: 2, relQ: 0.125, ratio: 3, thr: [-24, -14], knee: 2,
      why: {
        ru: '1–3 мс и быстрый release: тарелки не должны качаться вместе с бочкой.',
        en: '1–3 ms and a fast release: hats should not pump with the kick.'
      }
    },
    {
      id: 'bass', ru: 'Бас', en: 'Bass',
      atk: 18, relQ: 0.5, ratio: 4, thr: [-24, -16], knee: 4,
      why: {
        ru: '10–30 мс сохраняют атаку пальца или медиатора; 1/8 release держит грув и не размазывает ноты.',
        en: '10–30 ms keeps finger or pick attack; a 1/8 release holds the groove without smearing notes.'
      }
    },
    {
      id: 'vocal', ru: 'Вокал', en: 'Vocal',
      atk: 15, relQ: 0.125, ratio: 3.5, thr: [-20, -10], knee: 8,
      why: {
        ru: '10–25 мс и мягкое колено: 3–5 дБ контроля, дыхание и согласные остаются.',
        en: '10–25 ms with a soft knee: 3–5 dB of control, breath and consonants survive.'
      }
    },
    {
      id: 'guitar', ru: 'Гитара', en: 'Guitar',
      atk: 20, relQ: 0.5, ratio: 3, thr: [-20, -12], knee: 4,
      why: {
        ru: '15–30 мс — пики под контролем, атака медиатора на месте.',
        en: '15–30 ms keeps pick attack while taming peaks.'
      }
    },
    {
      id: 'keys', ru: 'Пиано / синт', en: 'Piano / synth',
      atk: 25, relQ: 0.5, ratio: 2.5, thr: [-20, -12], knee: 8,
      why: {
        ru: '20–40 мс не убивает атаку пиано; мягкое колено держит аккорды ровно.',
        en: '20–40 ms leaves piano attack intact; a soft knee evens out chords.'
      }
    },
    {
      id: 'drumBus', ru: 'Drum bus', en: 'Drum bus',
      atk: 3, relQ: 0.25, ratio: 4, thr: [-16, -10], knee: 3,
      why: {
        ru: 'Параллель: быстрый attack, высокий ratio и короткий release дают плотность. Микс — на соседнем фейдере.',
        en: 'Parallel: fast attack, high ratio and a short release add density. Blend on a parallel fader.'
      }
    },
    {
      id: 'mixBus', ru: 'Mix bus', en: 'Mix bus',
      atk: 15, relQ: 0.5, ratio: 2.5, thr: [-12, -8], knee: 8,
      why: {
        ru: 'Клей 2–4 дБ: медленный attack пропускает транзиенты, ratio 2–3 не душит микс.',
        en: '2–4 dB of glue: slow attack lets transients through, ratio 2–3 does not choke the mix.'
      }
    },
    {
      id: 'master', ru: 'Мастер', en: 'Master',
      atk: 40, relQ: 0.5, ratio: 1.8, thr: [-10, -6], knee: 10,
      why: {
        ru: 'Только прозрачность: 1–2 дБ, ratio 1.3–2, attack 30–100 мс. Не вместо лимитера.',
        en: 'Transparency only: 1–2 dB, ratio 1.3–2, attack 30–100 ms. Not a limiter replacement.'
      }
    }
  ];

  // ---------- режимы ----------
  // Трек — источники по отдельности. Шина — параллель/джамп: быстрее и злее.
  // Мастер — медленно и прозрачно. Диапазоны заданы явно.
  const MODES = [
    {
      id: 'track', ru: 'Трек', en: 'Track',
      atkMul: 1, relMul: 1, ratioDelta: 0, thrShift: 0, kneeDelta: 0, depthMul: 1,
      atkRange: [1, 60], ratioRange: [1.5, 8]
    },
    {
      id: 'bus', ru: 'Шина', en: 'Bus',
      atkMul: 0.5, relMul: 0.6, ratioDelta: 2.5, thrShift: -4, kneeDelta: -2, depthMul: 1.25,
      atkRange: [0.5, 20], ratioRange: [3, 12]
    },
    {
      id: 'master', ru: 'Мастер', en: 'Master',
      atkMul: 2.5, relMul: 1.5, ratioDelta: -1, thrShift: 4, kneeDelta: 3, depthMul: 0.6,
      atkRange: [5, 120], ratioRange: [1.2, 2.5]
    }
  ];

  // ---------- жанры ----------
  // Общие множители + точечные поправки по группам.
  const GENRES = [
    {
      id: 'pop', ru: 'Поп', en: 'Pop',
      atkMul: 1, relMul: 1, ratioDelta: 0, kneeDelta: 0,
      overrides: {},
      preQ: 0.03125, holdQ: 0.25, relQ: 0.5, look: 4, depth: -4
    },
    {
      id: 'hiphop', ru: 'Хип-хоп / трэп', en: 'Hip-hop / trap',
      atkMul: 0.8, relMul: 0.75, ratioDelta: 0.5, kneeDelta: -1,
      overrides: {
        kick: { atkMul: 0.6, relMul: 0.5 },
        bass: { atkMul: 1.2, relMul: 2, ratioDelta: -0.5 }
      },
      preQ: 0.03125, holdQ: 0.5, relQ: 0.5, look: 4, depth: -5
    },
    {
      id: 'rock', ru: 'Рок', en: 'Rock',
      atkMul: 1.1, relMul: 1, ratioDelta: 0.3, kneeDelta: 0,
      overrides: {
        guitar: { atkMul: 0.7, relMul: 0.5, ratioDelta: 1 },
        drumBus: { relMul: 0.5, ratioDelta: 1 }
      },
      preQ: 0.015625, holdQ: 0.25, relQ: 0.25, look: 3, depth: -3
    },
    {
      id: 'edm', ru: 'EDM / хаус', en: 'EDM / house',
      atkMul: 0.7, relMul: 0.5, ratioDelta: 1, kneeDelta: -2,
      overrides: {
        kick: { atkMul: 0.5, ratioDelta: 1 },
        bass: { relMul: 1, ratioDelta: 0 },
        vocal: { relMul: 2 },
        keys: { relMul: 1 }
      },
      preQ: 0.015625, holdQ: 0.25, relQ: 0.25, look: 3, depth: -6
    },
    {
      id: 'acoustic', ru: 'Акустика / лайв', en: 'Acoustic / live',
      atkMul: 1.3, relMul: 2, ratioDelta: -0.7, kneeDelta: 3,
      overrides: {
        kick: { relMul: 0.5 },
        hats: { relMul: 0.5 },
        keys: { relMul: 0.5 },
        vocal: { atkMul: 1.2 }
      },
      preQ: 0.03125, holdQ: 0.5, relQ: 1, look: 5, depth: -2.5
    }
  ];

  const MODS = [
    { key: 'straight', mul: 1 },
    { key: 'dotted', mul: 1.5 },
    { key: 'triplet', mul: 2 / 3 }
  ];
  const TIMING_NOTES = [0.0625, 0.125, 0.25, 0.5, 1, 2];

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round1 = v => Math.round(v * 10) / 10;

  function find(list, id) {
    return list.find(x => x.id === id) || list[0];
  }

  function buildPreset(groupId, genreId, modeId, bpm) {
    const g = find(GROUPS, groupId);
    const gen = find(GENRES, genreId);
    const mode = find(MODES, modeId);
    const o = (gen.overrides && gen.overrides[g.id]) || {};

    const atkMul = (o.atkMul == null ? 1 : o.atkMul) * gen.atkMul * mode.atkMul;
    const relMul = (o.relMul == null ? 1 : o.relMul) * gen.relMul * mode.relMul;
    const ratioDelta = (o.ratioDelta == null ? 0 : o.ratioDelta) + gen.ratioDelta + mode.ratioDelta;
    const kneeDelta = (o.kneeDelta == null ? 0 : o.kneeDelta) + gen.kneeDelta + mode.kneeDelta;

    const attack = clamp(g.atk * atkMul, mode.atkRange[0], mode.atkRange[1]);
    const releaseQ = nearestQ(g.relQ * relMul);
    const ratio = clamp(round1(g.ratio + ratioDelta), mode.ratioRange[0], mode.ratioRange[1]);
    const knee = clamp(Math.round(g.knee + kneeDelta), 0, 20);

    return {
      group: g,
      attack,
      releaseQ,
      releaseMs: qMs(releaseQ, bpm),
      ratio,
      thr: [g.thr[0] + mode.thrShift, g.thr[1] + mode.thrShift],
      knee,
      why: g.why
    };
  }

  function buildSidechain(genreId, modeId, bpm) {
    const gen = find(GENRES, genreId);
    const mode = find(MODES, modeId);
    return {
      preQ: gen.preQ,
      preMs: qMs(gen.preQ, bpm),
      holdQ: gen.holdQ,
      holdMs: qMs(gen.holdQ, bpm),
      relQ: gen.relQ,
      relMs: qMs(gen.relQ, bpm),
      look: gen.look,
      depth: round1(gen.depth * mode.depthMul)
    };
  }

  const fmtMs = v => v >= 1000 ? v.toFixed(1) : v.toFixed(2);
  const fmtS = v => (v / 1000).toFixed(v >= 10000 ? 2 : 3);

  return {
    GROUPS, GENRES, MODES, MODS, TIMING_NOTES,
    qMs, barQ, barMs, noteLabel, nearestQ,
    buildPreset, buildSidechain,
    fmtMs, fmtS
  };
});
