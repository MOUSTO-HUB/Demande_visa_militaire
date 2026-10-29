# Extension « Visa DGRECM – Remplisseur » (Chrome et Edge)

Remplit le formulaire officiel de demande de visa chinois (COVA, `consular.mfa.gov.cn`) à partir des dossiers **validés** de la plateforme. L'agent garde la main : il vérifie chaque page, résout le captcha, téléverse les pièces et soumet lui-même. L'extension ne clique jamais sur « Suivant » ni « Soumettre ».

## Installer (poste d'un agent)

1. Construire l'extension (une fois par version) :

   ```bash
   pnpm --filter @visa/extension build
   ```

2. Dans Chrome ou Edge, ouvrir `chrome://extensions` (ou `edge://extensions`), activer le **mode développeur**, cliquer **Charger l'extension non empaquetée** et choisir le dossier `extension/dist`.
3. Cliquer sur l'icône de l'extension, puis ⚙ : saisir l'adresse de l'API de la plateforme (par défaut `http://localhost:3200/api`) et accepter l'autorisation demandée.
4. Se connecter avec son compte de la plateforme (même mot de passe, même code de double authentification).

Pour un déploiement sur tous les postes, la DGSIC peut imposer l'extension par stratégie de groupe Windows (pas besoin du Chrome Web Store).

## 1. Relever les champs du site (une fois, puis à chaque changement du site)

Le formulaire COVA change sans prévenir : l'extension ne contient aucune liste de champs figée. Un agent connecté sur COVA :

1. ouvre chaque page du formulaire de demande ;
2. clique **Relever les champs de cette page** ;
3. pour les sections qui n'apparaissent qu'après un choix (conjoint si « marié », visas antérieurs si « oui »…), fait ce choix puis relève de nouveau la page.

Chaque champ est enregistré avec son libellé, son type (texte, liste, date, choix, case…), son caractère **obligatoire ou facultatif** et, pour les listes, tous les choix proposés par le site. Aucune donnée de dossier n'est envoyée pendant un relevé.

## 2. Relier les champs (plateforme → « Correspondances COVA »)

Pour chaque champ relevé, la gestion choisit :

- **Réponse du dossier** : la question du dossier à recopier (proposée automatiquement d'après le libellé, à vérifier) ;
- **Valeur fixe** : la même pour tous (ex. objet du voyage) ;
- **Ignorer** : jamais rempli ;
- **Conversions** pour les listes : `MASCULIN = 1` (sinon le choix est cherché par son libellé) ;
- **Remplir** : coché d'office pour les champs obligatoires, à cocher pour un champ facultatif que l'on veut aussi remplir.

## 3. Remplir une demande

1. Sur COVA, ouvrir la page du formulaire.
2. Dans l'extension, choisir le dossier (ses dossiers « en saisie », puis les dossiers validés), puis le mode :
   - **Obligatoires + champs cochés** (réglages de la gestion) ;
   - **Obligatoires seulement**.
3. Cliquer **Remplir cette page**. Le dossier passe « En saisie » et vous est attribué.
   - encadré **vert** : rempli par l'extension ;
   - encadré **rouge pointillé** : obligatoire à saisir vous-même (réponse absente du dossier, choix introuvable, champ pas encore relié) ;
   - un champ facultatif non coché, ou déjà rempli sur la page, n'est jamais touché.
4. Vérifier, compléter, passer à la page suivante, recommencer.
5. Les pièces (photo, passeport…) sont téléchargeables dans l'extension, déjà au format du site.
6. Après la soumission sur COVA, saisir le **numéro de demande** et cliquer **Marquer soumis**.

Chaque relevé et chaque page remplie sont inscrits au journal d'audit.

## Fonctionnement technique

- `src/moteur/` : script exécuté dans la page (monde « MAIN », accès aux composants Vue 2 / Element UI du site) ; `natif.ts` gère les formulaires HTML ordinaires.
- `src/pont.ts` : relais entre la fenêtre de l'extension et la page.
- `src/popup/` : fenêtre de l'extension ; `src/commun/valeurs.ts` : conversion des réponses (listes, dates, nationalités → pays), testée sans navigateur.
- Jetons en mémoire de session du navigateur (effacés à sa fermeture) ; aucune donnée de dossier n'est conservée par l'extension.

## Essais

```bash
pnpm --filter @visa/extension test
```

Les tests du moteur utilisent de vrais composants Vue 2 + Element UI sur un formulaire **fictif** (`essai/formulaire.js`). Pour le voir dans un navigateur :

```bash
pnpm --filter @visa/extension build
```

```bash
pnpm --filter @visa/extension essai
```

puis ouvrir http://localhost:4100.
