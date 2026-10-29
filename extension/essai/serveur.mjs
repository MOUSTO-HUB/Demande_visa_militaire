// Serveur de la page d'essai : http://localhost:4100 (formulaire fictif + moteur construit).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RACINE = new URL('..', import.meta.url).pathname.replace(
  /^\/(\w:)/,
  '$1',
);
const FICHIERS = {
  '/': 'essai/index.html',
  '/formulaire.js': 'essai/formulaire.js',
  '/page.js': 'dist/page.js',
  '/vue.js': 'node_modules/vue/dist/vue.min.js',
  '/element.js': 'node_modules/element-ui/lib/index.js',
  '/element.css': 'node_modules/element-ui/lib/theme-chalk/index.css',
};
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

createServer(async (req, res) => {
  const chemin = (req.url ?? '/').split('?')[0];
  const fichier =
    FICHIERS[chemin] ??
    (chemin.startsWith('/fonts/') && !chemin.includes('..')
      ? `node_modules/element-ui/lib/theme-chalk${chemin}`
      : null);
  if (!fichier) return res.writeHead(404).end();
  try {
    const contenu = await readFile(join(RACINE, fichier));
    res.writeHead(200, {
      'Content-Type': `${TYPES[extname(fichier)] ?? 'application/octet-stream'}; charset=utf-8`,
    });
    res.end(contenu);
  } catch {
    res.writeHead(404).end();
  }
}).listen(4100, () => console.log('Page d’essai : http://localhost:4100'));
