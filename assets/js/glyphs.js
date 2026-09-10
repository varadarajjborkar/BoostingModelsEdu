/* Small chapter icons, shared by the home page and the face-off cheat sheet. */
const GLYPHS = (() => {
  const E = 'stroke="var(--rule-2)" stroke-width="2"';
  return {
    '00-warmup':
      `<svg viewBox="0 0 60 44" aria-hidden="true"><line x1="30" y1="10" x2="16" y2="30" ${E}/><line x1="30" y1="10" x2="44" y2="30" ${E}/>` +
      '<circle cx="30" cy="10" r="5" fill="var(--ink-2)"/><rect x="8" y="28" width="16" height="10" rx="3" fill="var(--c1)"/>' +
      '<rect x="36" y="28" width="16" height="10" rx="3" fill="var(--c2)"/></svg>',
    '01-adaboost':
      '<svg viewBox="0 0 60 44" aria-hidden="true"><circle cx="10" cy="30" r="3" fill="var(--c1)"/><circle cx="22" cy="15" r="6.5" fill="var(--c2)"/>' +
      '<circle cx="33" cy="32" r="3.5" fill="var(--c1)"/><circle cx="47" cy="20" r="9" fill="var(--c2)"/></svg>',
    '02-gradient-boosting':
      '<svg viewBox="0 0 60 44" aria-hidden="true"><path d="M4,34 C18,2 36,42 56,10" fill="none" stroke="var(--rule-2)" stroke-width="2"/>' +
      '<path d="M4,30 H16 V19 H28 V26 H40 V17 H56" fill="none" stroke="var(--c1)" stroke-width="2.5" stroke-linejoin="round"/></svg>',
    '03-xgboost':
      '<svg viewBox="0 0 60 44" aria-hidden="true"><path d="M6,6 Q30,62 54,6" fill="none" stroke="var(--ink-2)" stroke-width="2"/>' +
      '<path d="M13,20 Q20,6 28,31" fill="none" stroke="var(--c2)" stroke-width="2"/>' +
      '<circle cx="13.2" cy="20.3" r="3.5" fill="var(--c2)"/><circle cx="30" cy="34" r="3.5" fill="var(--c1)"/></svg>',
    '04-lightgbm':
      '<svg viewBox="0 0 60 44" aria-hidden="true">' +
      [[6, 10], [14, 20], [22, 32], [30, 26], [38, 16], [46, 8]]
        .map(([x, h]) => `<rect x="${x}" y="${40 - h}" width="6" height="${h}" rx="1.5" fill="var(--c3)"/>`).join('') +
      '</svg>',
    '05-catboost':
      `<svg viewBox="0 0 60 44" aria-hidden="true"><path d="M30,7 L17,21 M30,7 L43,21 M17,21 L10,32 M17,21 L23,32 M43,21 L37,32 M43,21 L50,32" ${E} fill="none"/>` +
      '<circle cx="30" cy="7" r="4.5" fill="var(--ink-2)"/><circle cx="17" cy="21" r="4.5" fill="var(--c5)"/><circle cx="43" cy="21" r="4.5" fill="var(--c5)"/>' +
      [6, 19, 33, 46].map((x, i) => `<rect x="${x}" y="31" width="9" height="8" rx="2" fill="${i % 2 ? 'var(--c2)' : 'var(--c1)'}"/>`).join('') +
      '</svg>',
    '06-faceoff':
      '<svg viewBox="0 0 60 44" aria-hidden="true"><rect x="8" y="22" width="13" height="18" rx="2" fill="var(--c1)"/>' +
      '<rect x="23.5" y="9" width="13" height="31" rx="2" fill="var(--c3)"/><rect x="39" y="16" width="13" height="24" rx="2" fill="var(--c2)"/></svg>',
  };
})();
