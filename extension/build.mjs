// Construit l'extension dans dist/ (à charger dans Chrome ou Edge : « Charger l'extension non empaquetée »).
import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await build({
  entryPoints: {
    page: 'src/moteur/page.ts',
    pont: 'src/pont.ts',
    popup: 'src/popup/popup.ts',
  },
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  outdir: 'dist',
  // Pas de code distant ni d'évaluation : exigences du Manifest V3.
  legalComments: 'none',
});
for (const fichier of [
  'manifest.json',
  'src/popup/popup.html',
  'src/popup/popup.css',
])
  await cp(fichier, `dist/${fichier.split('/').pop()}`);
console.log('Extension construite dans extension/dist');
