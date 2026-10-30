# Projet Demande_visa_militaire

Plateforme interne DGRECM/DGSIC : préparation et suivi des demandes de visa d'études des militaires boursiers (Chine : COVA, Russie : kdmid).

Spécifications et coûts : `docs/CAHIER_DES_CHARGES.md`. Mise en service : `docs/DEPLOIEMENT.md`, recette : `docs/RECETTE.md`, formation : `docs/GUIDE_AGENTS.md`, `docs/GUIDE_MILITAIRE.md`.

## Production

- `docker-compose.prod.yml` : Caddy (seul exposé ; agents limités aux adresses internes, `deploy/caddy/Caddyfile`), site, API, PostgreSQL, sauvegarde chiffrée (`deploy/sauvegarde`). Images : `api/Dockerfile` (migrations au démarrage), `web/Dockerfile` (Next standalone). Configuration : `deploy/env.production.exemple` → `.env.production` (jamais versionné).
- Espace du militaire sur Internet : facultatif, `deploy/caddy/sites/espace-internet.caddy.exemple` (seulement `/m/…` et `/espace`). Une nouvelle page publique du militaire doit y être ajoutée, et exclue du `matcher` de `web/proxy.ts`.
- Pièces effacées automatiquement à la clôture + `CONSERVATION_MOIS` (`campagnes/conservation.service.ts`, règles dans `conservation.regles.ts`). Consentement du militaire : `espace/consentement.ts` (changer `VERSION_CONSENTEMENT` si le texte change).
- Scripts `*.sh` en fins de ligne LF (`.gitattributes`).

## Stack

- API : NestJS 12 + Prisma 7 + PostgreSQL (dossier `/api`), modules ES (imports locaux suffixés `.js`), lint oxlint, tests Vitest (`*.spec.ts`). Routes sous `/api`, documentation OpenAPI sur `/api/docs` (hors production).
- Site : Next.js 16 (App Router) + Tailwind (dossier `/web`), port 3002. Lire `web/node_modules/next/dist/docs/` avant d'écrire du code (`proxy.ts` au lieu de middleware, `params`/`searchParams` asynchrones, `refresh()` dans les Server Actions).
- Extension Chrome/Edge Manifest V3 (dossier `/extension`, TypeScript + esbuild, `pnpm --filter @visa/extension build` → `dist/`) : voir `extension/README.md`.
- Monorepo pnpm ; Prettier commun (guillemets simples) ; base de développement : `docker compose` sur le port 5436.

## Extension et sites officiels

- Sites pris en charge : COVA (Chine, Vue 2 + Element UI) et kdmid (Russie, ASP.NET WebForms) ; hôtes dans `extension/manifest.json` et `SITES` de `popup.ts`, écrans `web/app/(app)/sites/[pays]` (`chine`, `russie`).
- Aucun champ de site n'est écrit en dur : l'extension **relève** les champs de la page (`moteur/element.ts` pour Vue 2 + Element UI via `__vue__`, `moteur/natif.ts` pour le HTML : libellé voisin, marque `RequiredFieldMark`, `Page_Validators`), l'API les stocke (`ChampSite`, module `api/src/sites`) avec une correspondance (`CHAMP`, `FIXE`, `IGNORER`, `A_DEFINIR`) proposée par `sites/proposition.ts` (motifs français, anglais, chinois, russe). `remplir` vaut `obligatoire` au premier relevé ; `formatDate` est réglable (date en texte, ou `dd`/`MM`/`yyyy` pour des listes séparées) et n'est pas effacé par un relevé qui n'en donne pas.
- Le plan de remplissage est calculé hors de la page par `extension/src/commun/valeurs.ts` (`planifier`, `decider`, `choisirOption`) ; jamais d'écrasement d'un champ déjà rempli, jamais de clic sur « Suivant »/« Soumettre ». Les choix d'une liste lus sur la page priment sur ceux du relevé (listes en cascade).
- Listes qui rechargent la page (`postback-dropdown`, `__doPostBack`) : `remplirNatif` les pose en dernier, une par clic, après sa réponse (`rechargement` dans le résultat).
- Le script de page (monde MAIN) ne parle qu'au pont par `postMessage` ; les jetons restent dans `chrome.storage.session`.
- Tests du moteur sur des formulaires **fictifs** (`extension/essai/formulaire.js`, vrais Vue 2 + Element UI ; `extension/essai/webforms.html`, structure WebForms ; sous jsdom) ; ne jamais reproduire les sites officiels.

## Règles du domaine

- **Dictionnaire des champs** (`api/src/referentiel/champs.ts`) : l'union des questions des formulaires officiels. Champs `MILITAIRE` (fiche réutilisée : colonnes de `Militaire` si `colonne`, sinon `Militaire.profil`) et `DOSSIER` (`Dossier.donnees`, valeur par défaut dans `Campagne.valeursCommunes`, jamais pour `communInterdit`). Ajouter une question = ajouter une entrée ici ; le site s'adapte seul (`GET /referentiel`).
- Toute saisie passe par `repartir()`/`normaliser()` (`referentiel/donnees.ts`) : majuscules latines sans accent pour les champs `latin`, dates `AAAA-MM-JJ`, téléphones E.164 (+224 par défaut).
- Contrôles : `controler()` (même fichier) ; transitions de statut et droits par rôle : `dossiers/statuts.regles.ts`. Un dossier n'est modifiable qu'en `A_COMPLETER` (agents) ou `A_VALIDER` (gestion).
- **Sincérité** : le système recopie les réponses validées, il ne propose ni ne modifie jamais une réponse pour tromper les autorités consulaires. Jamais de contournement de captcha ni de soumission automatique sur les sites officiels.
- Passeport : analyse et corrections de la MRZ dans `api/src/mrz/mrz.ts` (`lireMrz` ; une correction n'est gardée que si une seule version passe les chiffres de contrôle). Photo lue **dans le navigateur** (`web/lib/ocr-passeport.ts`, `components/lecture-passeport.tsx`, Tesseract.js) : seul le texte reconnu part vers `POST /mrz/analyse`, jamais l'image. Moteur et modèle copiés dans `web/public/ocr` par `web/scripts/copier-ocr.mjs` (lancé par `dev` et `build`, non versionné, exclu de `proxy.ts`, du lint et du `no-store`) ; CSP : `'wasm-unsafe-eval'` et `worker-src 'self'`.
- Exigences de format des pièces : `referentiel/pieces.ts` (valeurs à confirmer par le relevé de la phase 0). Préparation des images : `pieces/preparation.ts` (sharp).

## Espace du militaire, messages, suivi

- Espace du militaire (`api/src/espace`, site `app/m/[jeton]` et `app/espace`) : lien personnel (`AccesMilitaire`, jeton en empreinte + chiffré) puis code à 6 chiffres par email/SMS ; jeton `{ sub: dossierId, typ: 'militaire' }` de 2 heures, cookie `visa_espace` à part. Routes `@EspaceMilitaire()` (+ `@MilitaireCourant()`) : `JwtAuthGuard` n'y accepte que ce jeton et le refuse partout ailleurs ; le dossier vient du jeton, jamais d'un paramètre. Questions posées : `espace/champs-militaire.ts` (jamais les réponses communes de la campagne ni les sections PROFESSION et DECLARATIONS). Le militaire ne modifie qu'en `A_COMPLETER` (`verifierModifiableParMilitaire`) ; audit avec utilisateur null et `par: 'MILITAIRE'`.
- Messages (`api/src/messages`) : toujours par `MessagesService.enfiler` (file en base, table `messages`, envoyée toutes les 30 s par `PlanificateurService`) ou `envoyerCode` (immédiat). Textes dans `modeles.ts`, composés à l'envoi : le lien et le code ne sont jamais stockés (aperçu masqué). Rappels : `rappels.regles.ts` (clé unique par rappel). Envoi : `EnvoiService` (SMTP, passerelle SMS HTTP ; simulation dans le journal hors production). `ENVOIS_AUTOMATIQUES=non` coupe le planificateur.
- Suivi (`api/src/suivi`) : `alertes.regles.ts` (fonction pure) ; `GET /campagnes/:id/suivi` et `GET /alertes`.

## Sécurité

- Toutes les routes exigent un jeton sauf `@Public()` ; restreindre avec `@Roles(...)`. `src/securite/routes.spec.ts` inventorie les routes : une nouvelle route doit porter `@Roles`/`@Public`, sinon être justifiée dans `OUVERTES_A_TOUS_CONNECTES` ; un nouveau contrôleur doit être ajouté à `CONTROLEURS`.
- Rôles : ADMIN (DGSIC), GESTIONNAIRE (DGRECM), OPERATEUR (saisie), LECTEUR (hiérarchie, jamais les pièces).
- Pièces chiffrées (AES-256-GCM, `CLE_PIECES`) par `StockageService` ; ne jamais exposer `cleStockage`.
- Consultations, modifications, exports et changements de statut : `AuditService.journaliser`.
- Comptes créés par un ADMIN (mot de passe provisoire affiché une fois) ; premier ADMIN : `node dist/cli/initialiser.js`.
- Double authentification par application (TOTP, `auth/totp.ts`, `DoubleAuthService`), obligatoire pour ADMIN et GESTIONNAIRE (`connexion.regles.ts`) : `/auth/connexion` peut renvoyer `{ doubleAuth }` au lieu d'une session. Tant qu'elle n'est pas activée, le jeton porte `aActiver` et `JwtAuthGuard` ne laisse passer que les routes `@AvantDoubleAuth()` (profil, mot de passe, activation). Secret chiffré en base (`chiffrerTexte`), codes de secours stockés en empreintes.
- Données de démonstration toujours fictives.

## Toujours

- Interface et messages en français.
- Tests unitaires sur la logique métier ; validation des entrées (class-validator).
- Modifier `api/prisma/schema.prisma` puis `pnpm db:migrate` ; ne jamais éditer une migration déjà poussée.
- Vérifier avant de terminer : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`.
