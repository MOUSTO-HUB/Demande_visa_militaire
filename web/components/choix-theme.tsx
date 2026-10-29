'use client';

import { useState } from 'react';
import { COOKIE_THEME, COULEUR_BARRE, type Theme } from '@/lib/theme';

/** Bouton ☀️/🌙 : passe le site en clair ou en sombre et le mémorise (1 an). */
export function ChoixTheme({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);
  const suivant: Theme = theme === 'sombre' ? 'clair' : 'sombre';
  const libelle = suivant === 'sombre' ? 'Mode sombre' : 'Mode clair';

  const basculer = () => {
    document.documentElement.dataset.theme = suivant;
    for (const meta of document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]',
    )) {
      meta.content = COULEUR_BARRE[suivant];
    }
    const securise = location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `${COOKIE_THEME}=${suivant}; path=/; max-age=31536000; samesite=lax${securise}`;
    setTheme(suivant);
  };

  return (
    <button
      type="button"
      onClick={basculer}
      title={libelle}
      aria-label={libelle}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 sm:px-3"
    >
      <span aria-hidden>{suivant === 'sombre' ? '🌙' : '☀️'}</span>
      <span className="hidden lg:inline">{libelle}</span>
    </button>
  );
}
