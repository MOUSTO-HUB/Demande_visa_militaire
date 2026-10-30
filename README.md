# Demande_visa_militaire

Plateforme de préparation et de suivi des demandes de visa d'études des militaires boursiers (Chine, Russie), pour la DGRECM avec l'appui de la DGSIC.

- Spécifications et coûts : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md)
- Phases livrées : **Phase 1** (base des dossiers, double authentification), **Phase 2** (extension pour le site chinois COVA) et **Phase 3** (même extension pour le site russe kdmid), voir [extension/README.md](extension/README.md).

## Extension pour les sites officiels (phases 2 et 3)

- **Relevé** : sur chaque page du formulaire (COVA ou kdmid), l'agent clique « Relever les champs de cette page » ; tous les champs sont enregistrés, obligatoires ou facultatifs, avec les choix des listes.
- **Correspondances** (menus « Correspondances COVA » et « Correspondances kdmid ») : chaque champ est relié à une réponse du dossier (proposition automatique d'après le libellé, en français, anglais, chinois ou russe), à une valeur fixe, ou ignoré ; format de date réglable. « Remplir » est coché d'office pour les obligatoires seulement.
- **Remplissage** : « Remplir cette page » recopie les réponses du dossier validé ; les obligatoires restés vides sont encadrés en rouge pour l'agent ; les facultatifs non cochés sont sautés. Sur kdmid, une liste qui recharge la page est posée en dernier, et l'agent clique de nouveau après le rechargement. Captcha, pièces et soumission restent à l'agent ; le numéro de demande revient dans le dossier.

## Ce que fait la phase 1

- **Campagnes** : une vague de boursiers vers un pays. Les réponses communes (établissement, dates, adresse, financement…) sont saisies **une seule fois** et reprises dans tous les dossiers.
- **Import Excel ou CSV** de la liste de la DGRECM : vérification ligne par ligne, puis création des fiches et des dossiers.
- **Fiche unique par militaire**, réutilisée d'une campagne à l'autre.
- **Lecture du passeport** : photo ou scan de la page d'identité (lu dans le navigateur, l'image n'est ni envoyée ni conservée), lecteur MRZ ou saisie des deux lignes. Les chiffres de contrôle sont vérifiés, les erreurs de lecture évidentes corrigées (0/O, « < » lu K ou L, caractère en trop) seulement quand une seule correction est possible ; l'agent vérifie l'aperçu, surtout le nom et les prénoms (sans chiffre de contrôle, comparés à ceux du dossier), avant d'enregistrer.
- **Contrôles automatiques** : champs exigés par chaque site, écriture latine en majuscules, dates, validité du passeport 6 mois après le séjour, pièces manquantes.
- **Pièces** : photos et scans mis automatiquement aux dimensions et au poids exigés par chaque site, chiffrés sur le disque.
- **Statuts** : à compléter → à valider → validé → en saisie → soumis → rendez-vous → déposé → visa obtenu / refusé, avec historique.
- **Fiche récapitulative PDF**, export Excel par campagne, journal d'audit de toutes les consultations.

## Démarrer en local

Prérequis : Node 22 ou plus, pnpm, Docker Desktop.

```bash
pnpm install
```

```bash
cp .env.example .env
```

Dans `.env`, remplacez `JWT_SECRET` et `CLE_PIECES` (les commandes de génération sont indiquées dans le fichier), puis :

```bash
pnpm db:up
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

- Site : http://localhost:3002 (comptes de démonstration : `admin@dgsic.test`, `gestion@dgrecm.test`, `operateur@dgrecm.test`, `lecteur@defense.test`, mot de passe `SEED_MOT_DE_PASSE`)
- Documentation de l'API : http://localhost:3200/api/docs

## Double authentification

Obligatoire pour les rôles ADMIN (DGSIC) et GESTIONNAIRE (DGRECM), facultative pour les autres. À la première connexion, ces comptes n'ont accès qu'à « Mon compte » tant qu'elle n'est pas activée :

1. installer une application gratuite sur le téléphone (Google Authenticator, Microsoft Authenticator ou FreeOTP) ;
2. dans « Mon compte », redonner son mot de passe, scanner le QR code et saisir le code à 6 chiffres ;
3. noter les 10 codes de secours (affichés une seule fois).

Ensuite, chaque connexion demande le mot de passe puis le code de l'application. Elle fonctionne sans réseau ni SMS sur le téléphone. Téléphone perdu sans code de secours : un ADMIN fait « Nouveau mot de passe » dans « Comptes », ce qui retire aussi l'application ; l'agent la réactive à la connexion suivante.

Premier compte d'une vraie installation (sans données de démonstration) :

```bash
node api/dist/cli/initialiser.js prenom.nom@exemple.gn Prénoms NOM
```

## Vérifications

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm format:check
```
