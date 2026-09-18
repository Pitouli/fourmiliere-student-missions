# Spécifications fonctionnelles et techniques

## 1. Présentation du projet

### 1.1 Objectif

L'application permet à des étudiants de faire valider les missions bénévoles qu'ils ont réalisées auprès d'associations, puis de consulter le détail et le total des heures validées.

Elle permet également :

- aux associations de valider une mission à partir d'un QR code présenté par l'étudiant ;
 - aux associations de valider une mission via saisie d'un code secret sur le téléphone de l'étudiant ;
- aux administrateurs de suivre les participations des étudiants ;
- aux administrateurs d'exporter les données au format CSV ;
- aux administrateurs de gérer les codes secrets attribués aux associations ;
- aux administrateurs de corriger manuellement les missions enregistrées.

### 1.2 Périmètre fonctionnel

L'application comprend trois espaces :

1. **Espace étudiant** : identification, consultation des missions, création d'une demande de validation et génération d'un QR code.
2. **Validation sur téléphone étudiant** : consultation de la demande, saisie du code secret par l'association depuis le téléphone de l'étudiant et validation.
3. **Espace d'administration** : suivi, export, gestion des codes association et correction des participations.

### 1.3 Terminologie

- **Mission** : type de participation bénévole issu du référentiel du site public.
- **Participation** : réalisation validée d'une mission par un étudiant, avec un nombre d'heures.
- **Demande de validation** : enregistrement temporaire créé avant validation de la participation.
- **Association** : organisme issu du référentiel public et susceptible de valider une participation.
- **Code association** : code secret numérique à six chiffres attribué localement à une association.
- **API publique** : API du site tiers fournissant les missions, leurs durées et les associations.
- **Cloud Function** : fonction serveur utilisée comme intermédiaire sécurisé entre l'interface web, la base de données et les API publiques.

---

## 2. Hypothèses structurantes

Les hypothèses suivantes précisent les points non entièrement définis dans le besoin initial :

1. L'étudiant ne crée pas de compte classique et ne possède pas de mot de passe.
2. La saisie d'une adresse email seule ne prouve pas l'identité de l'étudiant. Dans la version strictement conforme au besoin, cette identification sert uniquement à retrouver les missions associées à l'adresse saisie.
3. L'authentification par lien magique (one-time link) n'est pas requise pour ce projet : la consultation des missions peut être ouverte et l'identification étudiante peut se faire par saisie d'email conservée en session locale.
4. Les administrateurs utilisent l'authentification Supabase et doivent disposer d'un compte créé ou autorisé depuis le back-office Supabase.
5. Une mission ne peut être enregistrée qu'une seule fois pour un même étudiant.
6. Une demande de validation possède un identifiant aléatoire non prédictible transmis dans le QR code. L'email et le code association ne doivent pas être placés en clair dans l'URL.
7. Les associations récupérées depuis l'API publique sont distinctes des associations configurées localement avec un code secret.
8. Les codes association sont stockés sous forme de condensat cryptographique et ne sont jamais retournés par une API publique.
9. Les durées, missions et associations doivent être revalidées côté serveur au moment de la validation, même si elles ont déjà été affichées par l'interface.
10. Le terme « Superbase » du besoin initial est interprété comme **Supabase**.

---

## 3. Rôles et droits

### 3.1 Étudiant

L'étudiant peut :

- renseigner son adresse email pour s'identifier ;
- consulter les missions déjà validées pour cette adresse ;
- consulter le nombre d'heures de chaque mission ;
- consulter le nombre total d'heures validées ;
- sélectionner une nouvelle mission ;
 - initier une demande de validation et afficher l'interface de validation sur son téléphone ;
- se déconnecter.

Il ne peut pas :

- valider lui-même une mission ;
- modifier une participation validée ;
- accéder à l'administration ;
- appeler directement les API publiques tierces.

### 3.2 Association

Une personne représentant une association peut, depuis l'interface de validation affichée sur le téléphone de l'étudiant :

- consulter la mission concernée ;
- consulter l'adresse email de l'étudiant ;
- consulter la durée maximale de la mission ;
- diminuer le nombre d'heures réellement effectuées ;
- saisir le code secret de son association ;
- valider la participation.

Elle ne peut pas :

- augmenter le nombre d'heures au-delà du maximum défini par l'API publique ;
- valider deux fois la même mission pour le même étudiant ;
- modifier une participation après validation ;
- consulter les autres missions de l'étudiant.

### 3.3 Administrateur

L'administrateur peut :

- se connecter à l'espace d'administration ;
- consulter toutes les participations ;
- filtrer et rechercher les données ;
- exporter la matrice étudiants × missions au format CSV ;
- consulter les associations configurées ;
- rechercher une association dans le référentiel public ;
- attribuer ou remplacer son code secret à six chiffres ;
- ajouter manuellement une participation ;
- modifier une participation si cette capacité est retenue ;
- supprimer une participation ;
- consulter la traçabilité des opérations administratives.

---

## 4. Parcours étudiant

### 4.1 Page d'identification

#### Contenu

- Champ **Adresse email**.
- Bouton **S'identifier**.
- Zone d'affichage des erreurs.

#### Règles

- L'adresse email est obligatoire.
- L'adresse est normalisée avant utilisation : suppression des espaces en début et fin et conversion en minuscules.
- Le format de l'adresse est validé côté interface et côté serveur.
- Aucune autre méthode d'identification n'est affichée.

#### Comportement

Version simplifiée (retenue) :

1. L'étudiant saisit son email.
2. L'adresse est conservée dans la session locale.
3. Le tableau de bord affiche les données correspondant à cette adresse.

La version simplifiée est retenue car la consultation des missions n'est pas considérée comme sensible.

### 4.2 Tableau de bord étudiant

#### Contenu

- Email de l'étudiant identifié.
- Liste des missions validées.
- Pour chaque mission :
  - nom de la mission ;
  - nombre d'heures validées ;
  - date de validation, si disponible ;
  - association ayant validé la mission, si cette information doit être affichée.
- Nombre total d'heures validées.
- Bouton **Ajouter une mission**.
- Bouton **Se déconnecter**.

#### États particuliers

- Si aucune mission n'est enregistrée, afficher un état vide explicite.
- En cas d'indisponibilité du serveur, afficher une erreur et permettre une nouvelle tentative.
- Le total correspond à la somme des heures des participations non supprimées.

### 4.3 Ajout d'une mission

Le clic sur **Ajouter une mission** ouvre une fenêtre modale permettant de sélectionner une mission disponible. Après sélection, le flux de validation se déroule directement sur le téléphone de l'étudiant : l'application ouvre une page de validation locale où l'association saisira son code pour valider la participation.

#### Contenu et comportement de l'interface de validation (sur le téléphone de l'étudiant)

- L'email de l'étudiant est réaffiché en grand, lisible par l'association.
- Une liste déroulante propose les missions du jour (ou la liste restreinte fournie par la Cloud Function) parmi lesquelles l'étudiant peut indiquer celle qu'il est en train de réaliser.
- Le nombre d'heures lié à la mission sélectionnée est récupéré automatiquement depuis la Cloud Function et affiché de manière lisible.
- Sous ces informations, un clavier numérique (numpad) est affiché pour que l'association saisisse son code secret.
- Les touches du numpad sont disposées dans un ordre aléatoire à chaque affichage pour rendre la lecture des frappes plus difficile pour l'étudiant.
- Un champ d'entrée masqué affiche des petites étoiles pour chaque caractère saisi par l'association (masquage standard), avec un bouton **Annuler** à proximité.
- Un bouton **Valider** permet d'envoyer le code et les heures au serveur pour enregistrement.
- Après chaque tentative de validation (succès ou échec), une notification confirme le résultat à l'écran.
- Une pause minimale de 3 secondes est appliquée entre deux tentatives de soumission pour limiter les attaques par force et réduire la vitesse d'essais.

#### Chargement des missions

- Le navigateur appelle une Cloud Function interne qui interroge l'API publique du site tiers.
- La réponse est normalisée avant d'être retournée à l'interface.
- L'interface ne consomme jamais directement l'API publique (CORS). Une mise en cache serveur peut être utilisée pour limiter les appels.

#### Règles

- Une mission doit être sélectionnée.
- Une mission déjà validée pour cet étudiant ne doit pas être proposée ou doit être indiquée comme indisponible.
- Le serveur vérifie à nouveau l'existence et la durée maximale de la mission avant d'accepter une validation.

### 4.4 Génération du QR code

Après sélection de la mission, le serveur crée une demande de validation et retourne une URL publique de la forme :

```text
https://<domaine>/association/validation/<jeton-public>
```

Le QR code contient uniquement cette URL.

Le jeton public doit être :

- aléatoire ;
- non prédictible ;
- lié à une seule demande ;
- utilisable une seule fois après validation ;
- associé à une date d'expiration configurable.

La page affiche :

- le QR code ;
- le nom de la mission ;
- une instruction invitant l'association à scanner le code ;
- éventuellement un lien copiable équivalent.

---

## 5. Parcours de validation par l'association

### 5.1 Accès à la page

La page est accessible publiquement depuis l'URL contenue dans le QR code. Aucun compte association n'est requis.

Le serveur récupère la demande à partir du jeton public et vérifie :

- que la demande existe ;
- qu'elle n'est pas expirée ;
- qu'elle n'a pas déjà été utilisée ;
- qu'elle n'a pas été annulée ;
- que la mission n'a pas déjà été validée pour cet étudiant.

### 5.2 Informations affichées

- Nom de la mission.
- Email de l'étudiant.
- Nombre d'heures maximum de la mission.
- Champ **Nombre d'heures réalisées**, initialisé avec le maximum.
- Champ **Code association**, numérique à six chiffres.
- Bouton **Valider la mission**.

### 5.3 Saisie du nombre d'heures

- La valeur par défaut est la durée de référence reçue de l'API publique.
- Cette durée constitue également la valeur maximale autorisée.
- L'association peut uniquement réduire cette valeur.
- La valeur doit être supérieure ou égale à zéro.
- Les heures peuvent être entières ou décimales selon une règle de précision configurable.
- Valeur recommandée : pas de 0,25 heure, soit 15 minutes.

### 5.4 Validation serveur

Lors de la soumission, une Cloud Function effectue les contrôles suivants dans cet ordre :

1. Vérifier la présence et la validité du jeton de demande.
2. Vérifier le format et normaliser l'email étudiant issu de la demande.
3. Vérifier que la mission existe toujours dans le référentiel public.
4. Récupérer la durée maximale à jour de la mission depuis l'API publique.
5. Vérifier que le nombre d'heures est numérique et compris entre zéro et le maximum inclus.
6. Vérifier que le code association contient exactement six chiffres.
7. Identifier l'association locale correspondant au code fourni.
8. Vérifier, si le service public le permet, que l'association existe toujours dans le référentiel public.
9. Vérifier que la mission n'est pas déjà enregistrée pour cet étudiant.
10. Enregistrer la participation dans une transaction.
11. Marquer la demande comme validée et utilisée dans la même transaction.
12. Retourner un résultat de succès sans exposer d'information secrète.

### 5.5 Résultats possibles

- **Succès** : confirmation de l'enregistrement et affichage du nombre d'heures validées.
- **Demande inconnue ou expirée** : validation impossible.
- **Demande déjà utilisée** : afficher que la participation a déjà été traitée.
- **Mission déjà enregistrée** : aucun doublon n'est créé.
- **Code association invalide** : message générique, sans préciser si une association particulière possède un code.
- **Nombre d'heures invalide** : afficher la plage autorisée.
- **API publique indisponible** : ne pas valider la participation et inviter à réessayer ultérieurement.

---

## 6. Espace d'administration

### 6.1 Authentification et autorisation

- L'administrateur se connecte avec un compte Supabase Auth.
- Seuls les comptes disposant du rôle `admin` peuvent accéder aux écrans et fonctions d'administration.
- La présence du rôle est vérifiée côté serveur pour chaque opération sensible.
- Masquer un écran côté interface ne constitue pas un contrôle d'accès suffisant.
- Les politiques Row Level Security de Supabase doivent interdire tout accès administratif non autorisé.

### 6.2 Section « Suivi des étudiants »

#### Vue de suivi

La section permet de consulter la liste des participations avec au minimum :

- email étudiant ;
- mission ;
- nombre d'heures ;
- association ayant validé ;
- date de validation ;
- origine de la création : association ou administrateur.

Fonctions recommandées :

- recherche par email ;
- filtre par mission ;
- filtre par association ;
- filtre par période ;
- tri ;
- pagination.

#### Export CSV

Le fichier CSV représente une matrice :

- une colonne par étudiant ayant effectué au moins une mission ;
- une ligne par mission réalisée par au moins un étudiant ;
- à l'intersection, le nombre d'heures validées pour l'étudiant et la mission ;
- cellule vide ou valeur `0` lorsqu'aucune participation n'existe ;
- première colonne : identifiant ou nom de la mission.

Exemple :

```csv
mission,alice@example.org,bob@example.org
Collecte alimentaire,4,2
Nettoyage citoyen,3,
```

Contraintes d'export :

- encodage UTF-8 avec BOM pour une bonne ouverture dans les versions courantes d'Excel ;
- échappement correct des virgules, points-virgules, guillemets et retours à la ligne ;
- ordre déterministe des lignes et colonnes ;
- génération côté serveur afin de garantir le respect des droits d'accès ;
- possibilité d'utiliser le séparateur `;` pour un usage principalement français.

### 6.3 Gestion manuelle des participations

#### Ajout

L'administrateur peut déclarer une participation absente avec :

- email étudiant ;
- mission issue du référentiel public ;
- nombre d'heures ;
- association facultative ou obligatoire selon la règle métier retenue ;
- motif de l'ajout manuel obligatoire.

Les mêmes contrôles de format, d'existence de mission, de durée maximale et d'unicité s'appliquent.

#### Modification

Si la modification est activée, l'administrateur peut modifier le nombre d'heures dans la limite du maximum de la mission. Un motif est obligatoire.

#### Suppression

- La suppression est logique afin de conserver la traçabilité.
- Un motif est obligatoire.
- La participation supprimée n'apparaît plus dans le tableau étudiant, les totaux ni les exports standards.
- L'opération est enregistrée dans le journal d'audit.

### 6.4 Section « Codes associations »

#### Ajout d'une association

La page contient :

- une liste déroulante ou un champ de recherche alimenté par une Cloud Function ;
- la liste des associations récupérée depuis l'API publique ;
- un champ de code numérique à six chiffres ;
- un bouton **Ajouter l'association**.

Règles :

- l'association doit provenir du référentiel public ;
- le code doit contenir exactement six chiffres, zéros initiaux autorisés ;
- le code doit donc être traité comme une chaîne de caractères et non comme un entier ;
- un même code ne peut être attribué qu'à une seule association ;
- une association ne peut disposer que d'un seul code actif ;
- le code est haché avant stockage ;
- le code en clair n'est jamais réaffiché après enregistrement.

#### Liste des associations configurées

Le tableau présente :

- nom de l'association ;
- identifiant dans le référentiel public ;
- date d'ajout ;
- date de dernière modification du code ;
- statut actif ou inactif ;
- action **Modifier le code** ;
- action **Désactiver**, si retenue.

La modification du code remplace le condensat existant. L'ancien code devient immédiatement inutilisable.

---

## 7. Architecture technique

### 7.1 Composants

```text
Navigateur étudiant / association / administrateur
                       |
                       | HTTPS
                       v
             Application web React
                       |
                       | Supabase SDK / appels HTTPS
                       v
+------------------------------------------------------+
| Supabase                                             |
|                                                      |
|  - Auth : administrateurs et, recommandé, étudiants  |
|  - PostgreSQL : données applicatives                 |
|  - Row Level Security : contrôle d'accès             |
|  - Edge Functions / Cloud Functions : logique métier |
+------------------------------------------------------+
                       |
                       | Appels serveur à serveur
                       v
          API publique du site partenaire
          - référentiel des missions
          - durée maximale des missions
          - référentiel des associations
```

### 7.2 Principe d'intégration aux API publiques

Toutes les consommations d'API tierces passent par des Cloud Functions :

- `list-public-missions` ;
- `get-public-mission` ;
- `list-public-associations` ;
- éventuellement `get-public-association`.

Cette architecture :

- contourne les restrictions CORS légitimes côté navigateur en réalisant les appels côté serveur ;
- centralise la normalisation des réponses ;
- évite d'exposer les éventuels secrets techniques ;
- permet la mise en cache, le contrôle des délais et les nouvelles tentatives ;
- permet d'appliquer une limitation de débit ;
- protège l'application contre les changements mineurs du format de l'API tierce.

Les fonctions ne doivent pas agir comme un proxy ouvert. Elles n'acceptent que les opérations et paramètres explicitement prévus.

### 7.3 Cloud Functions applicatives

#### `list-public-missions`

- Retourne la liste normalisée des missions actives.
- Peut exclure les missions déjà réalisées par l'étudiant.
- Utilise un cache serveur à durée limitée.

#### `create-validation-request`

Entrée :

```json
{
  "missionExternalId": "string"
}
```

L'email est obtenu depuis la session authentifiée ou, pour la version simplifiée, transmis puis validé explicitement.

Traitements :

- validation de la mission ;
- contrôle de l'absence de participation existante ;
- invalidation facultative des anciennes demandes en attente pour la même paire étudiant/mission ;
- création d'un jeton aléatoire ;
- enregistrement de la demande ;
- retour de l'URL à encoder en QR code.

#### `get-validation-request`

- Prend un jeton public.
- Retourne uniquement les informations nécessaires à la validation.
- Ne retourne jamais de code association ni d'information d'administration.

#### `validate-participation`

Entrée :

```json
{
  "token": "string",
  "associationCode": "012345",
  "hours": 3.5
}
```

- Exécute tous les contrôles métier.
- Crée la participation de manière transactionnelle.
- Marque la demande comme utilisée.
- Garantit l'idempotence et l'absence de doublon.

#### `admin-export-participations`

- Réservée aux administrateurs.
- Produit le fichier CSV matriciel.
- Applique les éventuels filtres demandés.

#### `admin-create-participation`

- Réservée aux administrateurs.
- Applique les mêmes contrôles métier que la validation standard, hors code association si une dérogation administrative est prévue.
- Crée une entrée d'audit.

#### `admin-update-participation`

- Réservée aux administrateurs.
- Valide la nouvelle durée.
- Exige un motif.
- Crée une entrée d'audit.

#### `admin-delete-participation`

- Réservée aux administrateurs.
- Réalise une suppression logique.
- Exige un motif.
- Crée une entrée d'audit.

#### `admin-upsert-association-code`

- Réservée aux administrateurs.
- Vérifie l'association dans le référentiel public.
- Valide le code à six chiffres.
- Vérifie son unicité.
- Stocke uniquement son condensat.
- Crée une entrée d'audit.

---

## 8. Architecture de la base de données

### 8.1 Principes

- Base PostgreSQL fournie par Supabase.
- Identifiants internes en UUID.
- Identifiants externes conservés sous forme de chaînes pour ne pas dépendre de leur format.
- Emails normalisés en minuscules pour les contrôles d'unicité.
- Dates stockées en `timestamptz` et en UTC.
- Suppression logique des participations.
- Contraintes d'unicité en base, en complément des contrôles applicatifs.

### 8.2 Schéma relationnel

```text
student_profiles 1 ----- n validation_requests n ----- 1 mission_references
       |                                                  |
       |                                                  |
       +---------------- 1 participations n --------------+
                              |
                              n
                              |
                              0..1
                    association_credentials

admin_profiles 1 ----- n audit_logs
```

### 8.3 Table `student_profiles`

Représente les étudiants connus par leur adresse email.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Identifiant interne |
| `auth_user_id` | `uuid` | UNIQUE, nullable, FK vers `auth.users` | Compte Supabase si lien magique utilisé |
| `email` | `citext` | NOT NULL, UNIQUE | Email normalisé |
| `created_at` | `timestamptz` | NOT NULL | Date de création |
| `updated_at` | `timestamptz` | NOT NULL | Date de mise à jour |

### 8.4 Table `mission_references`

Cache local et historique minimal des missions issues du référentiel public. Cette table ne remplace pas la validation auprès de l'API au moment d'une opération sensible.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Identifiant interne |
| `external_id` | `text` | NOT NULL, UNIQUE | Identifiant fourni par l'API publique |
| `name` | `text` | NOT NULL | Nom courant de la mission |
| `max_hours` | `numeric(6,2)` | NOT NULL, CHECK >= 0 | Dernière durée maximale connue |
| `is_active` | `boolean` | NOT NULL, DEFAULT true | Mission active dans le dernier état connu |
| `source_payload` | `jsonb` | nullable | Réponse source utile au diagnostic |
| `last_synced_at` | `timestamptz` | NOT NULL | Dernière synchronisation |
| `created_at` | `timestamptz` | NOT NULL | Date de création locale |
| `updated_at` | `timestamptz` | NOT NULL | Date de mise à jour locale |

### 8.5 Table `association_credentials`

Stocke les associations configurées localement et leur secret de validation.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Identifiant interne |
| `external_id` | `text` | NOT NULL, UNIQUE | Identifiant dans le référentiel public |
| `name` | `text` | NOT NULL | Nom de l'association |
| `code_hash` | `text` | NOT NULL, UNIQUE | Condensat sécurisé du code à six chiffres |
| `code_last_changed_at` | `timestamptz` | NOT NULL | Dernier changement du code |
| `is_active` | `boolean` | NOT NULL, DEFAULT true | Autorisation de valider |
| `created_by` | `uuid` | NOT NULL, FK vers `auth.users` | Administrateur créateur |
| `updated_by` | `uuid` | NOT NULL, FK vers `auth.users` | Dernier administrateur |
| `created_at` | `timestamptz` | NOT NULL | Date de création |
| `updated_at` | `timestamptz` | NOT NULL | Date de mise à jour |

> Comme l'espace des codes à six chiffres est réduit, un simple hachage rapide est insuffisant. Utiliser un algorithme lent avec sel, par exemple Argon2id ou bcrypt, et ajouter une protection contre les tentatives répétées. Si l'unicité globale des codes doit être vérifiée sans conserver le code en clair, stocker en complément une empreinte déterministe HMAC avec une clé serveur distincte.

### 8.6 Table `validation_requests`

Stocke les demandes temporaires représentées par les QR codes.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Identifiant interne |
| `public_token_hash` | `text` | NOT NULL, UNIQUE | Empreinte du jeton public |
| `student_id` | `uuid` | NOT NULL, FK | Étudiant concerné |
| `mission_id` | `uuid` | NOT NULL, FK | Mission concernée |
| `status` | `text` | NOT NULL, CHECK | `pending`, `validated`, `expired`, `cancelled` |
| `expires_at` | `timestamptz` | NOT NULL | Date d'expiration |
| `validated_at` | `timestamptz` | nullable | Date de validation |
| `created_at` | `timestamptz` | NOT NULL | Date de création |
| `updated_at` | `timestamptz` | NOT NULL | Date de mise à jour |

Index recommandé :

```sql
CREATE INDEX idx_validation_requests_lookup
ON validation_requests (student_id, mission_id, status);
```

### 8.7 Table `participations`

Représente une mission validée pour un étudiant.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Identifiant interne |
| `student_id` | `uuid` | NOT NULL, FK | Étudiant |
| `mission_id` | `uuid` | NOT NULL, FK | Mission |
| `association_id` | `uuid` | nullable, FK | Association validatrice |
| `validation_request_id` | `uuid` | nullable, UNIQUE, FK | Demande à l'origine de la validation |
| `hours` | `numeric(6,2)` | NOT NULL, CHECK >= 0 | Nombre d'heures validées |
| `max_hours_at_validation` | `numeric(6,2)` | NOT NULL, CHECK >= 0 | Maximum renvoyé par l'API au moment de la validation |
| `source` | `text` | NOT NULL, CHECK | `association` ou `admin` |
| `validated_at` | `timestamptz` | NOT NULL | Date de validation |
| `created_by_admin_id` | `uuid` | nullable, FK vers `auth.users` | Administrateur en cas d'ajout manuel |
| `admin_reason` | `text` | nullable | Motif d'une opération manuelle |
| `deleted_at` | `timestamptz` | nullable | Date de suppression logique |
| `deleted_by` | `uuid` | nullable, FK vers `auth.users` | Administrateur ayant supprimé |
| `deletion_reason` | `text` | nullable | Motif de suppression |
| `created_at` | `timestamptz` | NOT NULL | Date de création |
| `updated_at` | `timestamptz` | NOT NULL | Date de mise à jour |

Contrainte principale :

```sql
CREATE UNIQUE INDEX uq_active_participation_student_mission
ON participations (student_id, mission_id)
WHERE deleted_at IS NULL;
```

Cette contrainte garantit qu'une mission active ne peut être enregistrée qu'une fois pour un étudiant, y compris en cas d'appels concurrents.

Contrainte complémentaire :

```sql
ALTER TABLE participations
ADD CONSTRAINT chk_participation_hours
CHECK (hours >= 0 AND hours <= max_hours_at_validation);
```

### 8.8 Table `admin_profiles`

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `user_id` | `uuid` | PK, FK vers `auth.users` | Compte Supabase |
| `role` | `text` | NOT NULL, DEFAULT `admin` | Rôle applicatif |
| `is_active` | `boolean` | NOT NULL, DEFAULT true | Accès actif |
| `created_at` | `timestamptz` | NOT NULL | Date d'autorisation |
| `updated_at` | `timestamptz` | NOT NULL | Date de mise à jour |

### 8.9 Table `audit_logs`

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Identifiant de l'événement |
| `actor_user_id` | `uuid` | nullable, FK vers `auth.users` | Auteur administratif |
| `action` | `text` | NOT NULL | Type d'opération |
| `entity_type` | `text` | NOT NULL | Type d'objet concerné |
| `entity_id` | `uuid` | nullable | Identifiant de l'objet |
| `reason` | `text` | nullable | Motif saisi |
| `before_data` | `jsonb` | nullable | État précédent |
| `after_data` | `jsonb` | nullable | Nouvel état |
| `request_id` | `text` | nullable | Identifiant technique de requête |
| `created_at` | `timestamptz` | NOT NULL | Date de l'opération |

### 8.10 Vue `active_participations`

```sql
CREATE VIEW active_participations AS
SELECT *
FROM participations
WHERE deleted_at IS NULL;
```

Cette vue peut être utilisée pour le tableau étudiant, les totaux et les exports.

---

## 9. Sécurité

### 9.1 Contrôle d'accès

- Activer Row Level Security sur toutes les tables exposées par Supabase.
- Les étudiants ne peuvent lire que leurs propres données lorsqu'une authentification par lien magique est utilisée.
- Les visiteurs de la page association n'accèdent jamais directement aux tables.
- Les validations passent exclusivement par une Cloud Function utilisant des droits serveur.
- Les administrateurs sont contrôlés par rôle côté serveur.
- Les clés de service Supabase ne sont jamais intégrées au frontend.

### 9.2 Protection des codes association

- Ne jamais stocker ni journaliser le code en clair.
- Ne jamais retourner le code existant dans l'administration.
- Limiter le nombre de tentatives par jeton, adresse IP et fenêtre temporelle.
- Ajouter un délai progressif après plusieurs échecs.
- Journaliser les volumes anormaux sans enregistrer le code soumis.
- Permettre à un administrateur de remplacer immédiatement un code compromis.

### 9.3 Protection des QR codes

- Utiliser au minimum 128 bits d'aléa cryptographique.
- Ne pas incorporer l'email dans l'URL.
- Stocker uniquement l'empreinte du jeton si possible.
- Définir une expiration, par exemple 7 jours, configurable.
- Refuser toute réutilisation après validation.
- Prévoir l'invalidation automatique des demandes obsolètes.

### 9.4 Intégrité et concurrence

La validation doit être transactionnelle et s'appuyer sur la contrainte unique en base. Un contrôle préalable dans le code ne suffit pas, car deux validations simultanées pourraient autrement créer un doublon.

### 9.5 Données personnelles

- L'email est une donnée personnelle.
- Limiter les informations affichées sur la page publique au strict nécessaire.
- Informer l'étudiant que son email sera visible par l'association qui scanne le QR code.
- Définir une durée de conservation des demandes expirées, journaux et participations.
- Prévoir les mécanismes de rectification et de suppression selon les règles applicables au projet.
- Protéger les exports CSV et limiter leur accès aux administrateurs autorisés.

---

## 10. Gestion des erreurs et résilience

### 10.1 API publique indisponible

- Définir un délai maximal par appel.
- Effectuer un nombre limité de nouvelles tentatives uniquement sur les erreurs transitoires.
- Utiliser un cache pour les listes de missions et d'associations.
- Ne pas finaliser une validation si la mission ou sa durée maximale ne peuvent pas être vérifiées.
- Afficher un message utilisateur compréhensible sans exposer les détails techniques.

### 10.2 Évolution du format de l'API

- Centraliser la conversion dans un adaptateur côté serveur.
- Valider les réponses reçues avec un schéma strict.
- Journaliser les réponses invalides de manière sécurisée.
- Ne retourner au frontend qu'un modèle interne stable.

### 10.3 Idempotence

Les opérations suivantes doivent être idempotentes ou protégées contre les répétitions :

- validation d'une demande ;
- ajout manuel d'une participation ;
- modification d'un code association ;
- génération d'un export.

---

## 11. Règles de gestion consolidées

| ID | Règle |
|---|---|
| RG-001 | Une adresse email doit être valide et normalisée avant enregistrement. |
| RG-002 | Une mission doit exister dans le référentiel public au moment de la création de la demande et de la validation. |
| RG-003 | Une mission ne peut être validée qu'une seule fois pour un même étudiant. |
| RG-004 | Le nombre d'heures doit être compris entre 0 et la durée maximale courante de la mission, bornes incluses. |
| RG-005 | La durée maximale utilisée doit être conservée dans la participation pour audit. |
| RG-006 | Un code association contient exactement six chiffres. |
| RG-007 | Les zéros initiaux du code association sont significatifs. |
| RG-008 | Un code actif identifie une seule association. |
| RG-009 | Le code association n'est jamais stocké ni affiché en clair après sa création. |
| RG-010 | Une association désactivée ne peut plus valider de mission. |
| RG-011 | Une demande de validation expirée, annulée ou déjà utilisée ne peut pas être validée. |
| RG-012 | Toutes les consommations d'API publiques sont effectuées par des Cloud Functions. |
| RG-013 | Toute opération administrative sensible est contrôlée côté serveur et auditée. |
| RG-014 | Une suppression administrative est logique et nécessite un motif. |
| RG-015 | Les participations supprimées sont absentes des totaux et exports standards. |
| RG-016 | Les contrôles applicatifs sont complétés par des contraintes d'intégrité en base. |

---

## 12. Critères d'acceptation principaux

### CA-001 — Identification étudiant

Étant donné une adresse email valide, lorsque l'étudiant clique sur **S'identifier**, alors il accède à son tableau de bord selon le mécanisme d'identification configuré.

### CA-002 — Rejet d'un email invalide

Étant donné une adresse mal formée, lorsque l'étudiant tente de s'identifier, alors l'application refuse la demande et affiche une erreur explicite.

### CA-003 — Consultation des missions

Étant donné un étudiant possédant des participations actives, son tableau de bord affiche chaque mission, ses heures et le total exact.

### CA-004 — Récupération des missions

Lorsque l'étudiant ouvre la modale d'ajout, la liste est récupérée via une Cloud Function et aucun appel direct à l'API publique n'est réalisé par le navigateur.

### CA-005 — Génération du QR code

Étant donné une mission valide non encore réalisée, lorsque l'étudiant génère une demande, alors un QR code contenant une URL opaque et temporaire est affiché.

### CA-006 — Durée par défaut

Lorsque la page association est ouverte, le champ d'heures est initialisé avec la durée maximale récupérée pour la mission.

### CA-007 — Réduction des heures

Étant donné une durée maximale de 4 heures, l'association peut valider 3 heures mais ne peut pas valider 4,25 heures.

### CA-008 — Code association incorrect

Étant donné un code inconnu ou désactivé, la validation est refusée et aucune participation n'est créée.

### CA-009 — Validation réussie

Étant donné une demande active, une mission valide, un code association correct et une durée autorisée, la participation est créée et la demande passe à l'état `validated` dans une même transaction.

### CA-010 — Prévention des doublons

Étant donné une participation déjà active pour la paire étudiant/mission, toute nouvelle validation est refusée, y compris en cas de requêtes simultanées.

### CA-011 — Export CSV

Lorsque l'administrateur exporte les données, le fichier contient uniquement les étudiants et missions ayant au moins une participation active, avec les heures à chaque intersection.

### CA-012 — Ajout manuel

Un administrateur peut ajouter une participation manquante avec un motif, sous réserve des règles de validité et d'unicité.

### CA-013 — Suppression manuelle

Lorsqu'un administrateur supprime une participation avec un motif, celle-ci disparaît du tableau étudiant, des totaux et de l'export, mais reste traçable en base.

### CA-014 — Gestion d'un code association

Un administrateur peut attribuer ou remplacer un code à six chiffres pour une association du référentiel public. Le code en clair n'est pas récupérable après enregistrement.

### CA-015 — Refus d'accès à l'administration

Un utilisateur non administrateur ne peut ni charger les données administratives ni exécuter une fonction d'administration, même en appelant directement les endpoints.

---

## 13. Points à arbitrer avant développement

1. **Authentification étudiante** : lien magique recommandé ou simple session basée sur un email déclaré.
2. **Valeur zéro** : confirmer qu'une participation de zéro heure doit pouvoir être enregistrée plutôt que rejetée.
3. **Précision des heures** : heures entières, quarts d'heure ou toute valeur décimale à deux chiffres.
4. **Expiration du QR code** : durée de validité attendue.
5. **Association et mission** : confirmer si toute association configurée peut valider toute mission ou si certaines associations doivent être limitées à certaines missions.
6. **Association affichée à l'étudiant** : confirmer si son nom doit apparaître dans l'historique.
7. **Modification administrative** : confirmer si l'administrateur peut modifier directement une participation ou seulement la supprimer puis la recréer.
8. **Format CSV** : séparateur virgule ou point-virgule, et cellule vide ou `0` en l'absence de participation.
9. **Volume attendu** : nombre d'étudiants et de missions, car une matrice très large peut dépasser les limites pratiques d'Excel.
10. **Contrat des API publiques** : endpoints, authentification, limites de débit, pagination, politique de disponibilité et structure exacte des réponses.
11. **Définition d'un étudiant autorisé** : tout email valide ou uniquement certains domaines et établissements.
12. **Conservation des données** : durées applicables aux participations, demandes expirées, exports et journaux d'audit.

---

## 14. Hors périmètre initial

Sauf demande complémentaire, les éléments suivants ne sont pas inclus :

- création de comptes autonomes pour les associations ;
- validation automatique sans code association ;
- application mobile native ;
- notifications automatiques après validation ;
- import massif de participations ;
- gestion de plusieurs validations partielles pour une même mission ;
- système de points ou de récompenses ;
- édition de certificats de bénévolat.
