// Copie le moteur de lecture du passeport (Tesseract.js) dans public/ocr :
// le site le sert lui-même, sans service extérieur ni accès à Internet.
// Lancé avant `dev` et `build` ; le dossier public/ocr n'est pas versionné.
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dossier = (paquet) => dirname(require.resolve(`${paquet}/package.json`));
const cible = new URL('../public/ocr/', import.meta.url);
await mkdir(cible, { recursive: true });

const fichiers = [
  [join(dossier('tesseract.js'), 'dist/worker.min.js'), 'worker.min.js'],
  // Variantes LSTM du moteur (avec ou sans SIMD), choisies par le navigateur.
  ...[
    'tesseract-core-lstm.wasm.js',
    'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-relaxedsimd-lstm.wasm.js',
  ].map((f) => [join(dossier('tesseract.js-core'), f), f]),
  // Modèle anglais « best_int » (2,9 Mo) : la MRZ n'a que A-Z, 0-9 et « < ».
  [
    join(
      dossier('@tesseract.js-data/eng'),
      '4.0.0_best_int/eng.traineddata.gz',
    ),
    'eng.traineddata.gz',
  ],
];
for (const [source, nom] of fichiers)
  await copyFile(source, new URL(nom, cible));
console.log(
  `Lecture du passeport : ${fichiers.length} fichiers copiés dans public/ocr`,
);
