# Projet Demande_visa_militaire

Plateforme interne DGRECM/DGSIC : préparation et suivi des demandes de visa d'études des militaires boursiers (Chine : COVA, Russie : kdmid).

Spécifications et coûts : `docs/CAHIER_DES_CHARGES.md`.

## Stack

- API : NestJS 12 + Prisma 7 + PostgreSQL (dossier `/api`), modules ES (imports locaux suffixés `.js`), lint oxlint, tests Vitest (`*.spec.ts`). Routes sous `/api`, documentation OpenAPI sur `/api/docs` (hors production).
- Site : Next.js 16 (App Router) + Tailwind (dossier `/web`), port 3002. Lire `web/node_modules/next/dist/docs/` avant d'écrire du code (`proxy.ts` au lieu de middleware, `params`/`searchParams` asynchrones, `refresh()` dans les Server Actions).
- Monorepo pnpm ; Prettier commun (guillemets simples) ; base de développement : `docker compose` sur le port 5436.

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
- Données de démonstration toujours fictives.

## Toujours

- Interface et messages en français.
- Tests unitaires sur la logique métier ; validation des entrées (class-validator).
- Modifier `api/prisma/schema.prisma` puis `pnpm db:migrate` ; ne jamais éditer une migration déjà poussée.
- Vérifier avant de terminer : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`.
