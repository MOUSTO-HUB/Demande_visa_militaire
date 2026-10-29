# Cahier des charges — Demande de visa des militaires boursiers

**Projet :** VisaFlow DGRECM, plateforme de préparation et de suivi des demandes de visa d'études
**Maître d'ouvrage :** Direction Générale des Relations Extérieures et de la Coopération Militaire (DGRECM)
**Maître d'œuvre :** Direction Générale des Systèmes d'Information et de Communication (DGSIC)
**Version :** 1.0 du 29 octobre 2026

---

## 1. Contexte

La Chine et la Russie offrent chaque année des bourses d'études à des militaires guinéens. Chaque boursier doit déposer une demande de visa en remplissant le formulaire en ligne du site officiel du pays d'accueil :

| Pays | Site officiel | Visa visé |
|---|---|---|
| Chine | https://consular.mfa.gov.cn/ (formulaire COVA) | Visa d'études X1 (séjour de plus de 180 jours) ou X2 |
| Russie | https://visa.kdmid.ru/ (formulaire électronique du MAE russe) | Visa d'études |

Le formulaire imprimé est ensuite déposé à l'ambassade, à Conakry, avec les pièces justificatives.

La DGRECM gère ces campagnes. Pendant les pics, elle demande l'appui de la DGSIC. Le traitement prend malgré tout plusieurs jours, pour les raisons suivantes :

- chaque formulaire compte des dizaines de champs, ressaisis à la main depuis le passeport et des fiches papier ;
- une grande partie des informations est identique pour tous les boursiers d'une même vague (université, dates, adresse, financement, invitation), mais elle est retapée pour chaque dossier ;
- les erreurs de saisie (nom, numéro de passeport, dates) obligent à refaire des formulaires ou à corriger à l'ambassade ;
- les photos et les scans sont refusés quand ils n'ont pas le format ou le poids attendu ;
- personne n'a de vue d'ensemble de l'avancement des dossiers.

## 2. Objectifs

| N° | Objectif | Indicateur cible |
|---|---|---|
| O1 | Saisir chaque information une seule fois | 0 ressaisie entre la fiche et le formulaire officiel |
| O2 | Réduire le temps de remplissage d'un formulaire | moins de 10 minutes par formulaire (contre 45 à 90 minutes aujourd'hui) |
| O3 | Supprimer les erreurs de saisie d'identité | 0 dossier rejeté pour erreur d'identité ou de passeport |
| O4 | Traiter une campagne rapidement | 100 dossiers en 1 journée sur 3 ou 4 postes |
| O5 | Suivre l'avancement en temps réel | statut de chaque dossier visible par la DGRECM |
| O6 | Protéger les données des militaires | hébergement interne, chiffrement, traçabilité complète |

## 3. Périmètre

### 3.1 Inclus

- Base centrale des militaires boursiers, des campagnes et des dossiers.
- Import de la liste des boursiers depuis un fichier Excel ou CSV.
- Lecture automatique de la zone MRZ du passeport (OCR).
- Formulaire de pré-remplissage par le militaire lui-même, en français, sur téléphone ou ordinateur.
- Préparation des pièces aux formats exigés par chaque site (photo, scans).
- Extension de navigateur qui remplit les formulaires officiels chinois et russe.
- Suivi des dossiers, alertes, fiches récapitulatives et rapports.

### 3.2 Exclus

- **Soumission automatique sans intervention humaine.** La soumission reste faite par un agent.
- **Contournement des captchas, des limites ou des protections des sites officiels.** C'est interdit dans tous les cas.
- **Paiement des frais consulaires.**
- **Prise de rendez-vous automatique à l'ambassade.** Le système ne fait qu'enregistrer la date du rendez-vous.
- **Obtention des documents d'admission.** Les lettres d'admission, formulaires JW201/JW202 et invitations russes sont fournis par les universités et les autorités du pays d'accueil ; le système les stocke seulement.

### 3.3 Principe de sincérité des déclarations

Le système **recopie fidèlement** les informations validées par le militaire et la DGRECM. Il ne propose et n'altère jamais une réponse dans le but de tromper les autorités consulaires. Cela vaut notamment pour la profession, l'employeur, les séjours antérieurs et les antécédents. Les réponses aux questions sensibles relèvent de la DGRECM. Elles sont saisies dans la fiche campagne ou dans la fiche du militaire, puis validées par un gestionnaire.

## 4. Acteurs et rôles

| Rôle | Qui | Droits principaux |
|---|---|---|
| ADMIN | DGSIC | Comptes, configuration des sites, sauvegardes, journal d'audit |
| GESTIONNAIRE | Agents DGRECM | Campagnes, import, validation des fiches, suivi, rapports |
| OPERATEUR | Agents DGRECM ou DGSIC chargés de la saisie | Consultation des dossiers validés, remplissage via l'extension, enregistrement du numéro de demande |
| MILITAIRE | Boursier | Accès limité à sa seule fiche (lien personnel + code reçu par SMS ou email), remplissage et dépôt de ses pièces |
| LECTEUR | Hiérarchie | Tableaux de bord et rapports en lecture seule |

Un militaire ne voit que son propre dossier, et le contrôle est fait côté serveur.

## 5. Description fonctionnelle

### 5.1 Campagnes

- **F1.1 Créer une campagne :** pays, année, type de visa, établissement d'accueil, dates prévues du séjour, adresse dans le pays d'accueil, ville d'entrée, organisme payeur, contact dans le pays d'accueil, référence de la note ou de l'accord de bourse.
- **F1.2 Valeurs communes :** chaque champ des formulaires officiels peut recevoir une valeur par défaut au niveau de la campagne. Les dossiers en héritent, et la valeur peut être modifiée pour un militaire précis.
- **F1.3 Liste des pièces :** la liste des pièces exigées est paramétrable par campagne, avec format, taille et caractère obligatoire.
- **F1.4 Clôture :** une campagne close est archivée et ses pièces sensibles sont purgées après le délai fixé (voir 7.4).

### 5.2 Militaires et dossiers

- **F2.1 Import Excel ou CSV :** matricule, grade, nom, prénoms, unité, téléphone, email, établissement et filière. L'import se fait avec un aperçu, la détection des doublons (par matricule) et un rapport d'erreurs ligne par ligne.
- **F2.2 Fiche militaire :** elle est unique et réutilisée d'une campagne à l'autre (un militaire peut repartir).
- **F2.3 Dossier :** un dossier correspond à un militaire dans une campagne. Il porte les données propres à la demande et son statut.
- **F2.4 Données gérées :** elles couvrent l'union des champs des deux formulaires.
  - identité : nom, prénoms, anciens noms, sexe, date et lieu de naissance, nationalités ;
  - passeport : type, numéro, dates et lieu de délivrance, date d'expiration ;
  - état civil et famille : situation, conjoint, enfants, parents ;
  - adresses et contacts ;
  - études : établissements et diplômes ;
  - parcours professionnel : employeurs et fonctions sur la période demandée par chaque site ;
  - voyages et visas antérieurs, refus de visa éventuels ;
  - séjour prévu : dates, adresse, établissement, financement ;
  - assurance, si elle est demandée ;
  - références d'admission et d'invitation (numéro JW201/JW202, numéro de l'invitation russe) ;
  - réponses aux questions de sécurité des formulaires.
- **F2.5 Lecture du passeport :** une photo ou un scan de la page d'identité suffit. La MRZ est lue, sa somme de contrôle vérifiée, et les champs remplis. L'agent confirme avant l'enregistrement. L'OCR tourne de préférence dans le navigateur, sans envoi de l'image à un service extérieur.
- **F2.6 Contrôles :**
  - champs obligatoires selon le pays ;
  - noms et adresses en lettres latines majuscules, sans accent, comme dans le passeport ;
  - formats de date ;
  - passeport valable au moins 6 mois après la fin prévue du séjour (paramétrable) ;
  - cohérence des périodes ;
  - numéros de téléphone au format E.164.
- **F2.7 Statuts :** `A_COMPLETER` → `A_VALIDER` → `VALIDE` → `EN_SAISIE` → `SOUMIS` (avec le numéro de demande) → `RDV_PRIS` → `DEPOSE` → `VISA_OBTENU` ou `REFUSE`. Chaque changement est horodaté et attribué à son auteur.

### 5.3 Espace du militaire

- **F3.1 Accès :** le militaire reçoit un lien personnel et un code à usage unique par SMS ou par email. Il n'a pas de mot de passe à retenir.
- **F3.2 Formulaire guidé :** il est en français, découpé en étapes courtes, avec une aide sur chaque question et une sauvegarde automatique. Il fonctionne sur téléphone et avec une connexion faible.
- **F3.3 Dépôt des pièces :** photo d'identité, passeport, diplômes, lettre d'admission, etc. Le format est contrôlé immédiatement.
- **F3.4 Envoi pour validation :** une fois la fiche envoyée, elle n'est plus modifiable par le militaire, sauf si un gestionnaire la lui renvoie avec un commentaire.

### 5.4 Validation par la DGRECM

- **F4.1 File de validation :** les fiches à valider sont affichées avec les anomalies détectées.
- **F4.2 Actions :** valider, ou renvoyer au militaire avec un motif.
- **F4.3 Correction directe :** le gestionnaire peut corriger une fiche lui-même. La correction est tracée dans le journal.

### 5.5 Préparation des pièces

- **F5.1 Photo d'identité :** recadrage assisté, puis redimensionnement et compression aux exigences de chaque site (dimensions en pixels, poids, fond). Les exigences sont paramétrables, car elles peuvent changer.
- **F5.2 Scans :** conversion en JPEG ou PDF, redressement, compression sous le poids maximal.
- **F5.3 Contrôle :** un indicateur « conforme » ou « non conforme » s'affiche pour chaque pièce et chaque site.

### 5.6 Extension de navigateur « Remplisseur »

- **F6.1 Plateformes :** Chrome et Edge (Manifest V3). L'extension n'est active que sur `consular.mfa.gov.cn` et `visa.kdmid.ru`.
- **F6.2 Connexion :** l'opérateur se connecte avec son compte de la plateforme. L'extension affiche la liste des dossiers `VALIDE` ou `EN_SAISIE` qui lui sont attribués.
- **F6.3 Remplissage :** l'opérateur choisit un dossier et clique sur « Remplir cette page ». Tous les champs reconnus de la page affichée sont remplis : textes, listes, cases, dates. Les champs qui n'ont pas pu être remplis sont surlignés.
- **F6.4 Pages successives :** le remplissage se fait page par page. L'opérateur relit chaque page, puis passe à la suivante avec les boutons du site.
- **F6.5 Interventions humaines :** captcha, téléversement des pièces (l'extension indique quel fichier prendre et où il se trouve), vérification finale et soumission.
- **F6.6 Retour :** l'opérateur saisit ou capture le numéro de demande attribué par le site, et le dossier passe à `SOUMIS`. Le PDF généré par le site peut être joint au dossier.
- **F6.7 Correspondances :** le lien entre les champs de la plateforme et ceux de chaque site est décrit dans un fichier de configuration versionné (sélecteurs, valeurs des listes, transformations). L'ADMIN le met à jour depuis la plateforme quand un site change, sans republier l'extension.
- **F6.8 Discrétion :** l'extension ne conserve aucune donnée personnelle après la fermeture de l'onglet et n'envoie rien ailleurs qu'à la plateforme.
- **F6.9 Rythme :** l'extension ne fait aucune action automatique en boucle sur les sites officiels. Le rythme est celui de l'opérateur.

### 5.7 Suivi, alertes et documents

- **F7.1 Tableau de bord par campagne :** nombre de dossiers par statut, retards, anomalies.
- **F7.2 Attribution :** les dossiers sont répartis entre opérateurs, ce qui permet de travailler à plusieurs postes en parallèle.
- **F7.3 Alertes :**
  - passeport expirant trop tôt ;
  - pièce manquante ou non conforme ;
  - fiche non remplie à J-x ;
  - rendez-vous du lendemain.
- **F7.4 Fiche récapitulative PDF :** une par militaire, avec ses données, la liste des pièces à apporter, le numéro de demande et la date de rendez-vous.
- **F7.5 Exports :** exports Excel et rapports de campagne pour la hiérarchie.
- **F7.6 Messages aux militaires :** rappel de compléter la fiche et convocation au dépôt. Les canaux sont l'email (gratuit) et le SMS (optionnel, voir les coûts).

### 5.8 Administration

- **F8.1** Gestion des comptes et des rôles.
- **F8.2** Paramètres des pays : champs exigés, exigences des pièces, correspondances de l'extension.
- **F8.3** Journal d'audit consultable : qui a vu, modifié, exporté ou soumis quoi, quand et depuis quelle adresse IP.

## 6. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Langue | Interface et messages en français |
| Performance | Pages en moins de 2 secondes sur le réseau interne ; espace militaire utilisable en 3G |
| Disponibilité | Service pendant les heures ouvrables, avec une attention renforcée pendant les campagnes ; redémarrage automatique |
| Compatibilité | Postes Windows avec Chrome ou Edge récents ; téléphones Android et iPhone pour l'espace militaire |
| Volumétrie | Jusqu'à 500 dossiers par an et 50 Mo de pièces par dossier |
| Maintenabilité | Code versionné sur GitHub, tests automatisés de la logique métier, documentation d'exploitation |
| Évolutivité | Ajout d'un nouveau pays (Maroc, Turquie, Égypte, etc.) par configuration et nouvelles correspondances, sans refonte |

## 7. Sécurité et protection des données

Les données concernent des militaires. Leur sécurité est une exigence de premier rang.

### 7.1 Hébergement

- Serveur dans les locaux de la DGSIC, et non sur un cloud public étranger.
- Accès réservé au réseau interne ou au VPN pour les rôles ADMIN, GESTIONNAIRE et OPERATEUR.
- Seul l'espace militaire peut être ouvert sur Internet, si c'est nécessaire, derrière un relais HTTPS.

### 7.2 Accès

- Comptes nominatifs uniquement, avec des mots de passe robustes.
- Double authentification obligatoire pour ADMIN et GESTIONNAIRE.
- Blocage progressif après des échecs de connexion.
- Sessions courtes.

### 7.3 Chiffrement

- HTTPS partout.
- Pièces chiffrées sur le disque.
- Sauvegardes chiffrées, avec une copie hors du site (disque conservé dans un autre bâtiment).

### 7.4 Conservation

- Les scans de passeport et les pièces sont purgés à la clôture de la campagne + N mois (6 par défaut).
- La fiche d'identité est conservée pour les campagnes suivantes.
- L'historique des dossiers est conservé sans les pièces.

### 7.5 Traçabilité

Toute consultation, modification, exportation ou soumission est inscrite au journal d'audit.

### 7.6 Cadre légal

Le traitement doit respecter la loi guinéenne relative à la cybersécurité et à la protection des données à caractère personnel (L/2016/037/AN) et les règles internes de protection du secret des forces armées. Ce point est à valider par le service juridique.

### 7.7 Information des militaires

Le militaire est informé, et accepte à sa première connexion, que ses données sont transmises aux autorités consulaires du pays d'accueil pour sa demande de visa.

## 8. Architecture technique proposée

```
 Militaire (téléphone) ──HTTPS──┐
                                ▼
 Agents DGRECM/DGSIC ──► Site web (Next.js) ──► API (NestJS) ──► PostgreSQL
        │                                         │   │
        │                                         │   └──► Stockage chiffré des pièces
        ▼                                         └──────► Redis (files d'envoi SMS/email)
 Navigateur + extension « Remplisseur » ──► Sites officiels (COVA, kdmid)
        └──────────── API (dossiers, correspondances, numéro de demande)
```

| Brique | Technologie |
|---|---|
| Monorepo | pnpm (`/api`, `/web`, `/extension`, `/docs`) |
| API | NestJS, Prisma, PostgreSQL, validation class-validator, documentation OpenAPI |
| Site web | Next.js + Tailwind |
| Extension | TypeScript, Manifest V3, Chrome et Edge |
| OCR du passeport | Tesseract.js et analyseur MRZ open source, exécutés dans le navigateur |
| Traitement d'images | sharp côté serveur |
| PDF | génération côté serveur |
| Envois | Redis + BullMQ ; email par le serveur SMTP interne ; SMS par un fournisseur local (optionnel) |
| Déploiement | Docker Compose (relais Caddy, API, site, PostgreSQL, Redis, sauvegarde) |
| Tests | Vitest (unitaires et de bout en bout), tests de correspondance de l'extension sur des copies figées des pages officielles |

L'extension est distribuée en interne : installation par politique de groupe Windows, ou en mode développeur sur les quelques postes concernés. Une publication sur le Chrome Web Store n'est pas nécessaire.

## 9. Coûts financiers

### 9.1 Hypothèses

- **Taux de change indicatif :** 1 USD ≈ 8 650 GNF et 1 EUR ≈ 10 000 GNF. À actualiser au moment de l'achat.
- **Les montants sont des ordres de grandeur** à confirmer par devis auprès de fournisseurs locaux.
- **Tous les logiciels utilisés sont libres et gratuits** (NestJS, Next.js, PostgreSQL, Redis, Tesseract, Caddy, Docker). Il n'y a **aucune licence à payer**.
- **Les sites officiels chinois et russe sont gratuits.** Le remplissage du formulaire en ligne ne coûte rien. Seuls les frais consulaires sont payants, et ils sont hors périmètre (9.6).

### 9.2 Développement

| Option | Description | Coût direct estimé |
|---|---|---|
| **A. Réalisation interne DGSIC (recommandée)** | 2 développeurs pendant environ 3 mois, avec l'appui d'un assistant de programmation IA | **0 GNF** hors salaires. Prime de projet éventuelle à l'appréciation de la hiérarchie. Abonnement à un assistant IA de programmation : environ 20 à 100 USD par mois et par développeur (≈ 170 000 à 865 000 GNF), optionnel |
| B. Prestataire externe | Environ 60 à 120 jours-homme, sur une hypothèse de 800 000 GNF par jour | **≈ 48 à 96 millions GNF**, sur devis |

Pour l'option A, la charge se répartit approximativement ainsi :

| Phase | Charge |
|---|---|
| Phase 1 : base, import, OCR, fiches PDF | 4 semaines |
| Phase 2 : extension Chine | 3 semaines |
| Phase 3 : extension Russie | 2 semaines |
| Phase 4 : espace militaire, suivi, alertes | 3 semaines |
| Recette et formation | 1 à 2 semaines |

### 9.3 Infrastructure

| Poste | Si la DGSIC dispose déjà d'un serveur | Sinon (achat) |
|---|---|---|
| Serveur (ou machine virtuelle de 4 cœurs, 16 Go de RAM, 500 Go de SSD) | 0 GNF | Serveur d'entrée de gamme ou mini-PC professionnel : **≈ 8 à 15 millions GNF**, une fois |
| Onduleur pour le serveur | 0 GNF si déjà présent | **≈ 2 à 4 millions GNF**, une fois |
| Disques de sauvegarde (2 disques externes de 2 To en rotation) | — | **≈ 1,5 à 2,5 millions GNF**, une fois |
| Certificat HTTPS | 0 GNF (Let's Encrypt ou autorité interne) | 0 GNF |
| Nom de domaine | Inutile pour un usage interne | **≈ 150 000 à 300 000 GNF par an**, si l'espace militaire est ouvert sur Internet |
| Connexion Internet | Existante | Existante |

### 9.4 Matériel des postes de saisie

| Poste | Coût estimé |
|---|---|
| Ordinateurs des opérateurs | 0 GNF (postes existants) |
| Scanner de documents (1 ou 2), si les postes n'en ont pas | **≈ 2 à 4 millions GNF** chacun, une fois. Un téléphone récent suffit pour lire la MRZ |
| Fond uni pour les photos d'identité | ≈ 100 000 GNF |

### 9.5 Fonctionnement annuel

| Poste | Coût estimé |
|---|---|
| Emails aux militaires | 0 GNF (serveur SMTP interne ou messagerie existante) |
| SMS aux militaires (optionnel) | Environ 300 à 500 GNF par SMS, selon l'opérateur ou l'agrégateur. Pour 200 militaires × 5 SMS par campagne, **≈ 300 000 à 500 000 GNF par campagne** |
| Maintenance des correspondances quand les sites officiels changent | Environ 5 à 10 jours par an en interne (0 GNF direct) ; sinon ≈ 4 à 8 millions GNF par an chez un prestataire |
| Électricité, salle serveur | Coût existant |
| Formation des agents (1 à 2 jours) | 0 GNF en interne ; collation et support imprimé : ≈ 500 000 à 1 000 000 GNF |

### 9.6 Coûts hors périmètre, à prévoir par ailleurs

- Frais consulaires de visa, selon le pays et le type de visa, et selon les éventuelles exonérations accordées aux boursiers gouvernementaux, à vérifier auprès des ambassades.
- Photos d'identité, traductions et légalisations de diplômes, examens médicaux exigés par le pays d'accueil.
- Assurance santé si elle est exigée.

### 9.7 Synthèse

| Scénario | Investissement initial | Fonctionnement annuel |
|---|---|---|
| **Minimal** : interne DGSIC, serveur et postes existants, email uniquement | **0 GNF à ≈ 1 million GNF** | **≈ 0 GNF** |
| **Recommandé** : interne, achat d'un serveur, d'un onduleur et des sauvegardes, SMS activés | **≈ 12 à 22 millions GNF** | **≈ 1 à 2 millions GNF** (SMS, domaine éventuel) |
| **Externalisé** : prestataire + matériel neuf | **≈ 60 à 120 millions GNF** | **≈ 5 à 10 millions GNF** (maintenance + SMS) |

À titre de comparaison, une campagne de 100 dossiers mobilise aujourd'hui plusieurs agents pendant plusieurs jours. Le système ramène cette charge à environ une journée et réduit les déplacements et corrections dus aux erreurs.

## 10. Planning et livrables

| Phase | Contenu | Livrables | Durée |
|---|---|---|---|
| 0. Relevé | Remplir un vrai formulaire de chaque site avec un agent ; relever tous les champs, valeurs de listes, pièces et exigences de format ; copies figées des pages pour les tests | Dictionnaire des champs Chine et Russie | 1 semaine |
| 1. Base | Comptes, campagnes, import, fiches, OCR MRZ, contrôles, pièces, fiche PDF | Plateforme utilisable sans l'extension | 4 semaines |
| 2. Chine | Extension et correspondances COVA | Extension v1 | 3 semaines |
| 3. Russie | Correspondances kdmid | Extension v1.1 | 2 semaines |
| 4. Suivi | Espace militaire, attribution, tableau de bord, alertes, exports | Version complète | 3 semaines |
| 5. Mise en service | Recette, formation, déploiement, documentation d'exploitation | Procès-verbal de recette | 1 à 2 semaines |

Le total est d'environ **3 à 4 mois**. Il est conseillé de mettre la Phase 1 en service dès la campagne suivante, puis d'ajouter l'extension.

## 11. Critères de recette

1. Import de 100 militaires depuis un fichier Excel en moins de 5 minutes, avec un rapport des erreurs.
2. Lecture correcte de la MRZ sur au moins 95 % des passeports guinéens testés.
3. Remplissage complet d'un formulaire COVA et d'un formulaire kdmid de test, hors captcha et pièces, avec 0 champ erroné.
4. Formulaire rempli et soumis par un opérateur en moins de 10 minutes.
5. Photo et scans acceptés du premier coup par les deux sites.
6. Un militaire ne peut accéder qu'à sa fiche (test de sécurité).
7. Restauration d'une sauvegarde réussie sur un serveur vierge.
8. Journal d'audit complet pour un dossier de bout en bout.

## 12. Risques et parades

| Risque | Parade |
|---|---|
| Un site officiel modifie son formulaire | Correspondances en configuration, modifiables sans republier ; tests sur des copies figées ; alerte quand un champ n'est pas trouvé |
| Captcha ou blocage en cas d'usage intensif | Soumission humaine au rythme normal ; pas d'automatisation en boucle ; plusieurs postes en parallèle plutôt qu'un robot |
| Coupures d'électricité ou d'Internet | Onduleur ; sauvegarde automatique des saisies ; travail page par page sur les sites |
| Fuite de données | Hébergement interne, chiffrement, double authentification, audit, purge des pièces |
| Militaires qui ne remplissent pas leur fiche | Rappels automatiques ; saisie possible par un agent à partir des documents |
| Dépendance à un seul développeur | Code sur GitHub, documentation, au moins 2 personnes formées à la DGSIC |

## 13. Mesures complémentaires (sans développement)

- **Note verbale de la DGRECM aux ambassades de Chine et de Russie** pour demander un dépôt groupé des dossiers des boursiers ou des créneaux de rendez-vous réservés.
- **Liste officielle des pièces par pays**, mise à jour chaque année avec les ambassades.
- **Séance de photos d'identité groupée** au format exigé, en début de campagne.

## 14. Glossaire

- **COVA :** China Online Visa Application, le formulaire en ligne de demande de visa chinois.
- **kdmid :** le portail consulaire du ministère russe des Affaires étrangères.
- **JW201/JW202 :** formulaires chinois de demande de visa pour étudiant étranger, délivrés par l'université d'accueil (JW201 pour les boursiers du gouvernement chinois).
- **MRZ :** zone de lecture automatique, les deux lignes en bas de la page d'identité du passeport.
- **OCR :** reconnaissance automatique de caractères.
- **Correspondance :** la règle qui associe un champ de la plateforme à un champ d'un site officiel.
