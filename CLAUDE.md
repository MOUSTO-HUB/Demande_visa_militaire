# Projet Demande_visa_militaire

Plateforme interne DGRECM/DGSIC : préparation et suivi des demandes de visa d'études des militaires boursiers (Chine : COVA, Russie : kdmid).

Spécifications et coûts : `docs/CAHIER_DES_CHARGES.md`.

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
- Exigences de format des pièces : `referentiel/pieces.ts` (valeurs à confirmer par le relevé de la phase 0). Préparation des images : `pieces/preparation.ts` (sharp).

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
