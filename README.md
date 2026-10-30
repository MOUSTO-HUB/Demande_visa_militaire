# Demande_visa_militaire

Plateforme de préparation et de suivi des demandes de visa d'études des militaires boursiers (Chine, Russie), pour la DGRECM avec l'appui de la DGSIC.

- Spécifications et coûts : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md)
- Phases livrées : **Phase 1** (base des dossiers, double authentification), **Phase 2** (extension pour le site chinois COVA), **Phase 3** (même extension pour le site russe kdmid, voir [extension/README.md](extension/README.md)), **Phase 4** (espace du militaire, messages, alertes et tableau de bord) et **Phase 5** (mise en production).
- Mise en service : [docs/DEPLOIEMENT_UBUNTU.md](docs/DEPLOIEMENT_UBUNTU.md) (installation sur Ubuntu par script), [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) (installation, sauvegardes, restauration, exploitation), [docs/RECETTE.md](docs/RECETTE.md) (cahier de recette et procès-verbal), [docs/GUIDE_AGENTS.md](docs/GUIDE_AGENTS.md) (formation des agents), [docs/GUIDE_MILITAIRE.md](docs/GUIDE_MILITAIRE.md) (fiche à remettre aux boursiers).

## Espace du militaire, messages et alertes (phase 4)

- **Lien personnel** : sur la fiche d'un dossier (ou pour toute la campagne), la gestion envoie au militaire un lien vers son espace (valable 60 jours ; un nouveau lien remplace l'ancien). À l'ouverture, il reçoit un **code à 6 chiffres** par email ou SMS, aux coordonnées de sa fiche : le lien seul ne suffit pas. Session de 2 heures, sans mot de passe.
- **Formulaire guidé** (téléphone, connexion faible) : sa fiche seulement, par étapes courtes, enregistrée en quittant chaque champ ; dépôt des pièces avec contrôle immédiat du format ; envoi à la DGRECM, après quoi la fiche n'est plus modifiable sauf renvoi par un gestionnaire (avec le motif, envoyé au militaire). Les réponses communes de la campagne et les questions sensibles (profession, employeur, déclarations) restent à la DGRECM.
- **Messages** : lien, code, rappels automatiques de la fiche (7, 3 et 1 jour(s) avant la date limite de la campagne, puis le lendemain), convocation au dépôt quand le rendez-vous est pris, rappel la veille, relance à la main. Email par le serveur SMTP de la DGSIC, SMS optionnels (passerelle HTTP). Sans configuration, en développement, les messages sont écrits dans le journal de l'API. L'historique de chaque dossier ne garde ni le lien ni le code.
- **Suivi** : tableau de bord par campagne (statuts, retards, anomalies, liens envoyés, militaires connectés, messages en échec) et page **Alertes** : passeport expirant trop tôt, pièces manquantes, fiche à envoyer bientôt ou en retard, rendez-vous du lendemain, lien pas encore envoyé, message non parvenu.

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
- **Pièces** : photo recadrée sur le visage par l'agent ou le militaire (cadre aux proportions du site), photos et scans mis automatiquement aux dimensions et au poids exigés par chaque site, chiffrés sur le disque ; indicateur « conforme / non conforme » par pièce. Les exigences de chaque site se règlent dans « Paramètres » (ADMIN) sans mise à jour du logiciel.
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
