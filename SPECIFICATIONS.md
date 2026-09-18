# Spécifications fonctionnelles et techniques

## 1. Présentation du projet

### 1.1 Objectif

L'application permet à des étudiants de faire valider les events bénévoles qu'ils ont réalisées auprès d'organizations, puis de consulter le détail et le total des heures validées.

Elle permet également :

 - aux organizations de valider un event via saisie d'un code secret sur le téléphone de l'étudiant ;
 - aux administrateurs de suivre les participations des étudiants ;
 - aux administrateurs d'exporter les données au format CSV ;
 - aux administrateurs de gérer les codes secrets attribués aux organizations ;
 - aux administrateurs de corriger manuellement les events enregistrés.

### 1.2 Périmètre fonctionnel

L'application comprend trois espaces :

1. **Espace étudiant** : identification, consultation des events, création d'une demande de validation.
2. **Validation sur téléphone étudiant** : consultation de la demande, saisie du code secret par l'organization depuis le téléphone de l'étudiant et validation.
3. **Espace d'administration** : suivi, export, gestion des codes organization et correction des participations.

### 1.3 Terminologie

- **Event** : type de participation bénévole issu du référentiel du site public.
- **Participation** : réalisation validée d'un event par un étudiant, avec un nombre d'heures.
- **Demande de validation** : enregistrement temporaire créé avant validation de la participation.
- **Organization** : organisme issu du référentiel public et susceptible de valider une participation.
- **Code organization** : code secret numérique à six chiffres attribué localement à une organization.
- **API publique** : API du site tiers fournissant les events, leurs durées et les organizations.
- **Cloud Function** : fonction serveur utilisée comme intermédiaire sécurisé entre l'interface web, la base de données et les API publiques.

---

## 2. Hypothèses structurantes

Les hypothèses suivantes précisent les points non entièrement définis dans le besoin initial :

1. L'étudiant ne crée pas de compte classique et ne possède pas de mot de passe.
2. La saisie d'une adresse email seule ne prouve pas l'identité de l'étudiant. Dans la version strictement conforme au besoin, cette identification sert uniquement à retrouver les events associés à l'adresse saisie.
3. L'authentification par lien magique (one-time link) n'est pas requise pour ce projet : la consultation des events peut être ouverte et l'identification étudiante peut se faire par saisie d'email conservée en session locale.
4. Les administrateurs utilisent l'authentification Supabase et doivent disposer d'un compte créé ou autorisé depuis le back-office Supabase.
5. Un event ne peut être enregistré qu'une seule fois pour un même étudiant.
6. Une demande de validation possède un identifiant aléatoire non prédictible accessible depuis la session étudiante ou retourné au client lors de sa création. L'email et le code organization ne doivent pas être placés en clair dans une URL.
7. Les organizations récupérées depuis l'API publique sont distinctes des organizations configurées localement avec un code secret.
8. Les codes organization sont stockés sous forme de condensat cryptographique et ne sont jamais retournés par une API publique.
9. Les durées, events et organizations doivent être revalidés côté serveur au moment de la validation, même si elles ont déjà été affichées par l'interface.
10. Le terme « Superbase » du besoin initial est interprété comme **Supabase**.

---

## 3. Rôles et droits

### 3.1 Étudiant

L'étudiant peut :

- renseigner son adresse email pour s'identifier ;
- consulter les events déjà validés pour cette adresse ;

- modifier une participation validée ;
- accéder à l'administration ;
- appeler directement les API publiques tierces.

### 3.2 Organization

Une personne représentant une organization peut, depuis l'interface de validation affichée sur le téléphone de l'étudiant :

- consulter l'event concerné ;
- consulter l'adresse email de l'étudiant ;
- consulter la durée maximale de l'event ;
- diminuer le nombre d'heures réellement effectuées ;
- saisir le code secret de son organization ;
- valider la participation.

Elle ne peut pas :
- augmenter le nombre d'heures au-delà du maximum défini par l'API publique ;
- valider deux fois le même event pour le même étudiant ;
- modifier une participation après validation ;
- consulter les autres events de l'étudiant.

- consulter toutes les participations ;
- filtrer et rechercher les données ;
  - exporter la matrice étudiants × events au format CSV ;
- modifier une participation si cette capacité est retenue ;
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

La version simplifiée est retenue car la consultation des events n'est pas considérée comme sensible.

### 4.2 Tableau de bord étudiant

-#### Contenu

- Email de l'étudiant identifié.
- Liste des events validés.
- Pour chaque event :
  - nom de l'event ;
  - nombre d'heures validées ;
  - date de validation, si disponible ;
  - organization ayant validé l'event, si cette information doit être affichée.
- Nombre total d'heures validées.
- Bouton **Ajouter un event**.
- Bouton **Se déconnecter**.

#### États particuliers

- Si aucun event n'est enregistré, afficher un état vide explicite.
- En cas d'indisponibilité du serveur, afficher une erreur et permettre une nouvelle tentative.
- Le total correspond à la somme des heures des participations non supprimées.

### 4.3 Ajout d'un event

Le clic sur **Ajouter un event** ouvre une fenêtre modale permettant de sélectionner un event disponible. Après sélection, le flux de validation se déroule directement sur le téléphone de l'étudiant : l'application ouvre une page de validation locale où l'organization saisira son code pour valider la participation.

#### Contenu et comportement de l'interface de validation (sur le téléphone de l'étudiant)

- L'email de l'étudiant est réaffiché en grand, lisible par l'organization.
- Une liste déroulante propose les events du jour (ou la liste restreinte fournie par la Cloud Function) parmi lesquels l'étudiant peut indiquer celui qu'il est en train de réaliser.
- Le nombre d'heures lié à l'event sélectionné est récupéré automatiquement depuis la Cloud Function et affiché de manière lisible.
- Sous ces informations, un clavier numérique (numpad) est affiché pour que l'organization saisisse son code secret.
- Les touches du numpad sont disposées dans un ordre aléatoire à chaque affichage pour rendre la lecture des frappes plus difficile pour l'étudiant.
- Un bouton **Valider** permet d'envoyer le code et les heures au serveur pour enregistrement.
- Après chaque tentative de validation (succès ou échec), une notification confirme le résultat à l'écran.
- Une pause minimale de 3 secondes est appliquée entre deux tentatives de soumission pour limiter les attaques par force et réduire la vitesse d'essais.

#### Chargement des events
- Un event déjà validé pour cet étudiant ne doit pas être proposé ou doit être indiqué comme indisponible.
- Le serveur vérifie à nouveau l'existence et la durée maximale de l'event avant d'accepter une validation.



## 5. Parcours de validation par l'organization

### 5.1 Accès à la page

L'interface de validation est affichée sur le téléphone de l'étudiant immédiatement après la création de la demande. Aucun compte organization n'est requis : l'organization saisit son code secret sur l'interface présentée par l'étudiant.

Le serveur récupère la demande à partir de l'identifiant de demande transmis par le client et vérifie :

- que la demande existe ;
- qu'elle n'est pas expirée ;
- qu'elle n'a pas déjà été utilisée ;
- qu'elle n'a pas été annulée ;
- que l'event n'a pas déjà été validé pour cet étudiant.

### 5.2 Informations affichées

- Nom de l'event.
- Email de l'étudiant (affiché en grand pour la lisibilité).
- Nombre d'heures maximum de l'event.
- Champ **Nombre d'heures réalisées**, initialisé avec le maximum.
- Clavier numérique (numpad) avec touches disposées aléatoirement pour la saisie du **Code organization** (six chiffres).
- Champ d'entrée masqué affichant des étoiles pour chaque caractère saisi.
- Boutons **Valider** et **Annuler**.

### 5.3 Saisie du nombre d'heures

- La valeur par défaut est la durée de référence reçue de l'API publique.
- Cette durée constitue également la valeur maximale autorisée.
- L'organization peut uniquement réduire cette valeur.
- La valeur doit être supérieure ou égale à zéro.
- Les heures peuvent être entières ou décimales selon une règle de précision configurable.
- Valeur recommandée : pas de 0,25 heure, soit 15 minutes.

### 5.4 Validation serveur

Lors de la soumission, une Cloud Function effectue les contrôles suivants dans cet ordre :

1. Vérifier que la demande de validation identifiée par l'`id` fourni existe et est toujours `pending`.
2. Vérifier le format et normaliser l'email étudiant associé à la demande.
3. Vérifier que l'event existe toujours dans le référentiel public.
4. Récupérer la durée maximale à jour de l'event depuis l'API publique.
5. Vérifier que le nombre d'heures est numérique et compris entre zéro et le maximum inclus.
6. Vérifier que le code organization contient exactement six chiffres.
7. Identifier l'organization locale correspondant au code fourni (comparaison sécurisée du condensat).
8. Vérifier, si le service public le permet, que l'organization existe toujours dans le référentiel public.
9. Vérifier que l'event n'est pas déjà enregistrée pour cet étudiant.
10. Enregistrer la participation dans une transaction.
11. Marquer la demande comme validée et utilisée dans la même transaction.
12. Retourner un résultat de succès sans exposer d'information secrète.

### 5.5 Résultats possibles

- **Succès** : confirmation de l'enregistrement et affichage du nombre d'heures validées.
- **Demande inconnue ou expirée** : validation impossible.
- **Demande déjà utilisée** : afficher que la participation a déjà été traitée.
- **Event déjà enregistrée** : aucun doublon n'est créé.
- **Code organization invalide** : message générique, sans préciser si une organization particulière possède un code.
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
- event ;
- nombre d'heures ;
- organization ayant validé ;
- date de validation ;
- origine de la création : organization ou administrateur.

Fonctions recommandées :

- recherche par email ;
- filtre par event ;
- filtre par organization ;
- filtre par période ;
- tri ;
- pagination.

#### Export CSV

Le fichier CSV représente une matrice :

 - une colonne par étudiant ayant effectué au moins un event ;
 - une ligne par event réalisée par au moins un étudiant ;
 - à l'intersection, le nombre d'heures validées pour l'étudiant et l'event ;
 - cellule vide ou valeur `0` lorsqu'aucune participation n'existe ;
 - première colonne : identifiant ou nom de l'event.

Exemple :

```csv
event,alice@example.org,bob@example.org
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
- event issue du référentiel public ;
- nombre d'heures ;
- organization facultative ou obligatoire selon la règle métier retenue ;
- motif de l'ajout manuel obligatoire.

Les mêmes contrôles de format, d'existence d'event, de durée maximale et d'unicité s'appliquent.

#### Modification

Si la modification est activée, l'administrateur peut modifier le nombre d'heures dans la limite du maximum de l'event. Un motif est obligatoire.

#### Suppression

- La suppression est logique afin de conserver la traçabilité.
- Un motif est obligatoire.
- La participation supprimée n'apparaît plus dans le tableau étudiant, les totaux ni les exports standards.
- L'opération est enregistrée dans le journal d'audit.

### 6.4 Section « Codes organizations »

#### Ajout d'une organization

La page contient :

- une liste déroulante ou un champ de recherche alimenté par une Cloud Function ;
- la liste des organizations récupérée depuis l'API publique ;
- un champ de code numérique à six chiffres ;
- un bouton **Ajouter l'organization**.

Règles :

- l'organization doit provenir du référentiel public ;
- le code doit contenir exactement six chiffres, zéros initiaux autorisés ;
- le code doit donc être traité comme une chaîne de caractères et non comme un entier ;
- un même code ne peut être attribué qu'à une seule organization ;
- une organization ne peut disposer que d'un seul code actif ;
- le code est haché avant stockage ;
- le code en clair n'est jamais réaffiché après enregistrement.

#### Liste des organizations configurées

Le tableau présente :

- nom de l'organization ;
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
Navigateur étudiant / organization / administrateur
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
          - référentiel des events
          - durée maximale des events
          - référentiel des organizations
```

### 7.2 Principe d'intégration aux API publiques

Toutes les consommations d'API tierces passent par des Cloud Functions :

 - `list-public-events` ;
 - `get-public-event` ;
 - `list-public-organisations` ;
 - éventuellement `get-public-organisation`.

Cette architecture :

- contourne les restrictions CORS légitimes côté navigateur en réalisant les appels côté serveur ;
- centralise la normalisation des réponses ;
- évite d'exposer les éventuels secrets techniques ;
- permet la mise en cache, le contrôle des délais et les nouvelles tentatives ;
- permet d'appliquer une limitation de débit ;
- protège l'application contre les changements mineurs du format de l'API tierce.

Les fonctions ne doivent pas agir comme un proxy ouvert. Elles n'acceptent que les opérations et paramètres explicitement prévus.

### 7.3 Cloud Functions applicatives

#### `list-public-events`

- Retourne la liste normalisée des events actives.
- Peut exclure les events déjà réalisés par l'étudiant.
- Utilise un cache serveur à durée limitée.

#### `create-validation-request`

Entrée :

```json
{
  "eventExternalId": "string"
}
```

L'email est obtenu depuis la session ou, pour la version simplifiée, transmis puis validé explicitement.

Traitements :

 - validation de l'event ;
 - contrôle de l'absence de participation existante ;
 - invalidation facultative des anciennes demandes en attente pour la même paire étudiant/event ;
- création et enregistrement d'une demande de validation (statut `pending`) ;
- retour de l'`id` de la demande et des informations nécessaires pour afficher l'interface de validation sur le téléphone de l'étudiant.

#### `get-validation-request`

- Prend un `validationRequestId`.
 - Retourne uniquement les informations nécessaires à la validation (event, heures, email affichable, statut).
 - Ne retourne jamais de code organization ni d'information d'administration.

#### `validate-participation`

Entrée :

```json
{
  "validationRequestId": "uuid",
  "organizationCode": "012345",
  "hours": 3.5
}
```

- Exécute tous les contrôles métier (voir section 5.4).
- Crée la participation de manière transactionnelle.
- Marque la demande comme utilisée.
- Garantit l'idempotence et l'absence de doublon.

#### `admin-export-participations`

- Réservée aux administrateurs.
- Produit le fichier CSV matriciel.
- Applique les éventuels filtres demandés.

#### `admin-create-participation`

- Réservée aux administrateurs.
 - Applique les mêmes contrôles métier que la validation standard, hors code organization si une dérogation administrative est prévue.
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

#### `admin-upsert-organization-code`

- Réservée aux administrateurs.
- Vérifie l'organization dans le référentiel public.
- Valide le code à six chiffres.
- Vérifie son unicité.
- Stocke uniquement son condensat.
- Crée une entrée d'audit.

### 7.4 Contrats des API publiques (La Fourmilière)

Les API publiques du site partenaire doivent être consommées exclusivement par les Cloud Functions côté serveur. Le navigateur n'appelle jamais ces endpoints directement afin d'éviter les problèmes CORS et d'exposer des clés ou des paramètres sensibles.

1) API "Events" (endpoint externe: `/v1/missions`)

- Endpoint externe : `GET https://api.lafourmiliere-benevolat.fr/v1/missions`
- Paramètres recommandés : `date_from=YYYY-MM-DD` et `date_to=YYYY-MM-DD` (filtrage côté serveur).
- Comportement attendu : renvoie un objet contenant un tableau `events` et éventuellement `next_cursor` pour la pagination.
- Exemple de réponse :

```
{
  "events": [
    {
      "id": 63037,
      "city": "Paris",
      "description": "Une description complète de l'event",
      "max_attendees": 2,
      "name": "La balade alimentaire des Lucioles (15e)",
      "tagline": "Pars en maraude dans le 15ème arrondissement de Paris !\n",
      "zip_code": "75 015",
      "starts_at": "2026-09-18T20:30:00.000+02:00",
      "ends_at": "2026-09-18T23:00:00.000+02:00",
      "attendees_count": 0,
      "image_url": "https://assets.lafourmiliere-benevolat.fr/storage/sh18etx56pxvtmh13g82vn4x8zuq",
      "status": "upcoming",
      "category": {
        "id": 7,
        "name": "Lutte contre la précarité",
        "emoji": "🍲"
      },
      "organization": {
        "id": 11,
        "name": "Balade des Lucioles",
        "website": "https://labaladedeslucioles.org"
      }
    }
  ],
  "next_cursor": null
}
```

 - Normalisation côté Cloud Function (`list-public-events`) :
 - Traitement côté Cloud Function (`list-public-events`) :
  - Traiter chaque `event` renvoyé par l'API et produire pour le frontend un objet de sortie contenant au minimum :
    - `external_id` = `event.id` (string),
    - `name` = `event.name`,
    - `description` = `event.description`,
    - `starts_at`, `ends_at` (ISO 8601),
    - `max_hours` = durée calculée (différence `ends_at - starts_at`) en heures, arrondie à 2 décimales,
    - `category` et `organization` (id, name, website si fournis),
    - `image_url` si présent.
  - Retourner au client un tableau plat d'objets basés sur les `events`, ainsi que les informations de pagination si nécessaire.
  - Mettre en cache la réponse côté serveur (TTL configurable) pour limiter les appels externes.

2) API "Organisations"

- Endpoint externe : `GET https://api.lafourmiliere-benevolat.fr/v1/organisations`
- Comportement attendu : renvoie un objet contenant un tableau `organisations`.
- Exemple de réponse :

```
{
  "organisations": [
    {
      "id": 50,
      "name": "1000 collectes",
      "website": "https://laressourceriedesbatignolles.org/"
    },
    {
      "id": 104,
      "name": "Abajad",
      "website": "https://www.abajad.com/"
    },
    {
      "id": 62,
      "name": "Action Contre la Faim",
      "website": "https://www.actioncontrelafaim.org/"
    }
  ]
}
```

 - Traitement côté Cloud Function (`list-public-organisations`) :
  - Traiter chaque objet `organisation` renvoyé par l'API et exposer un objet `{ external_id, name, website }` au frontend.
  - Mettre en cache côté serveur (TTL configurable) et permettre une recherche/filtre sur le nom.

Recommandations communes :

- Les Cloud Functions effectuent la validation stricte des schémas de réponse (schéma JSON) et journalisent les erreurs côté serveur.
- Gérer la pagination (`next_cursor`) en exposant des paramètres `cursor` ou en agrégeant plusieurs pages côté fonction si demandé.
- Traiter les erreurs transitoires par retries avec backoff ; renvoyer une erreur compréhensible au frontend si l'API externe est indisponible.
- Ne jamais exposer de clés API ou de secrets dans les réponses envoyées au client.


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
student_profiles 1 ----- n validation_requests n ----- 1 event_references
       |                                                  |
       |                                                  |
       +---------------- 1 participations n --------------+
                              |
                              n
                              |
                              0..1
          organization_credentials

admin_profiles 1 ----- n audit_logs
```

### 8.3 Table `student_profiles`

Représente les étudiants connus par leur adresse email.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Identifiant interne |
| `auth_user_id` | `uuid` | UNIQUE, nullable, FK vers `auth.users` | Compte Supabase si un compte Supabase est lié |
| `email` | `citext` | NOT NULL, UNIQUE | Email normalisé |
| `created_at` | `timestamptz` | NOT NULL | Date de création |
| `updated_at` | `timestamptz` | NOT NULL | Date de mise à jour |

### 8.4 Table `event_references`

Cache local et historique minimal des events issus du référentiel public. Cette table ne remplace pas la validation auprès de l'API au moment d'une opération sensible.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Identifiant interne |
| `external_id` | `text` | NOT NULL, UNIQUE | Identifiant fourni par l'API publique |
| `name` | `text` | NOT NULL | Nom courant de l'event |
| `max_hours` | `numeric(6,2)` | NOT NULL, CHECK >= 0 | Dernière durée maximale connue |
| `is_active` | `boolean` | NOT NULL, DEFAULT true | Event actif dans le dernier état connu |
| `source_payload` | `jsonb` | nullable | Réponse source utile au diagnostic |
| `last_synced_at` | `timestamptz` | NOT NULL | Dernière synchronisation |
| `created_at` | `timestamptz` | NOT NULL | Date de création locale |
| `updated_at` | `timestamptz` | NOT NULL | Date de mise à jour locale |

### 8.5 Table `organization_credentials`

Stocke les organizations configurées localement et leur secret de validation.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Identifiant interne |
| `external_id` | `text` | NOT NULL, UNIQUE | Identifiant dans le référentiel public |
| `name` | `text` | NOT NULL | Nom de l'organization |
| `code_hash` | `text` | NOT NULL, UNIQUE | Condensat sécurisé du code à six chiffres |
| `code_last_changed_at` | `timestamptz` | NOT NULL | Dernier changement du code |
| `is_active` | `boolean` | NOT NULL, DEFAULT true | Autorisation de valider |
| `created_by` | `uuid` | NOT NULL, FK vers `auth.users` | Administrateur créateur |
| `updated_by` | `uuid` | NOT NULL, FK vers `auth.users` | Dernier administrateur |
| `created_at` | `timestamptz` | NOT NULL | Date de création |
| `updated_at` | `timestamptz` | NOT NULL | Date de mise à jour |

> Comme l'espace des codes à six chiffres est réduit, un simple hachage rapide est insuffisant. Utiliser un algorithme lent avec sel, par exemple Argon2id ou bcrypt, et ajouter une protection contre les tentatives répétées. Si l'unicité globale des codes doit être vérifiée sans conserver le code en clair, stocker en complément une empreinte déterministe HMAC avec une clé serveur distincte.


### 8.6 Table `validation_requests`

Stocke les demandes temporaires de validation.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Identifiant interne |
| `public_token_hash` | `text` | NOT NULL, UNIQUE | Empreinte du jeton public (si applicable) |
| `student_id` | `uuid` | NOT NULL, FK | Étudiant concerné |
| `event_id` | `uuid` | NOT NULL, FK | Event concerné |
| `status` | `text` | NOT NULL, CHECK | `pending`, `validated`, `expired`, `cancelled` |
| `expires_at` | `timestamptz` | NOT NULL | Date d'expiration |
| `validated_at` | `timestamptz` | nullable | Date de validation |
| `created_at` | `timestamptz` | NOT NULL | Date de création |
| `updated_at` | `timestamptz` | NOT NULL | Date de mise à jour |

Index recommandé :

```sql
CREATE INDEX idx_validation_requests_lookup
ON validation_requests (student_id, event_id, status);
```

### 8.7 Table `participations`

Représente un event validé pour un étudiant.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK | Identifiant interne |
| `student_id` | `uuid` | NOT NULL, FK | Étudiant |
| `event_id` | `uuid` | NOT NULL, FK | Event |
| `organization_id` | `uuid` | nullable, FK | Organization validatrice |
| `validation_request_id` | `uuid` | nullable, UNIQUE, FK | Demande à l'origine de la validation |
| `hours` | `numeric(6,2)` | NOT NULL, CHECK >= 0 | Nombre d'heures validées |
| `max_hours_at_validation` | `numeric(6,2)` | NOT NULL, CHECK >= 0 | Maximum renvoyé par l'API au moment de la validation |
| `source` | `text` | NOT NULL, CHECK | `organization` ou `admin` |
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
CREATE UNIQUE INDEX uq_active_participation_student_event
ON participations (student_id, event_id)
WHERE deleted_at IS NULL;
```

Cette contrainte garantit qu'un event actif ne peut être enregistré qu'une fois pour un étudiant, y compris en cas d'appels concurrents.

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
 - Les étudiants peuvent consulter les events sans lien magique ; l'identification peut se faire par saisie d'email conservée en session locale. Les opérations sensibles restent contrôlées côté serveur.
 - Les visiteurs de la page organization n'accèdent jamais directement aux tables.
- Les validations passent exclusivement par une Cloud Function utilisant des droits serveur.
- Les administrateurs sont contrôlés par rôle côté serveur.
- Les clés de service Supabase ne sont jamais intégrées au frontend.

### 9.2 Protection des codes organization

 - Ne jamais stocker ni journaliser le code en clair.
 - Ne jamais retourner le code existant dans l'administration.
 - Limiter le nombre de tentatives par demande, adresse IP et fenêtre temporelle.
 - Ajouter un délai progressif après plusieurs échecs.
 - Journaliser les volumes anormaux sans enregistrer le code soumis.
 - Permettre à un administrateur de remplacer immédiatement un code compromis.

### 9.3 Protection des sessions de validation

- Générer des identifiants de demande non prédictibles et de forte entropie.
 - Ne pas exposer de secret (code organization) dans une URL ou dans les journaux.
- Stocker uniquement les empreintes/condensats nécessaires (ne jamais stocker les codes en clair).
- Définir une expiration pour une demande de validation (par exemple 7 jours, configurable).
- Refuser toute réutilisation après validation et prévoir l'invalidation automatique des demandes obsolètes.

### 9.4 Intégrité et concurrence

La validation doit être transactionnelle et s'appuyer sur la contrainte unique en base. Un contrôle préalable dans le code ne suffit pas, car deux validations simultanées pourraient autrement créer un doublon.

### 9.5 Données personnelles

- L'email est une donnée personnelle.
- Limiter les informations affichées sur la page publique au strict nécessaire.
 - Informer l'étudiant que son email sera visible par l'organization lors de la validation sur son téléphone.
- Définir une durée de conservation des demandes expirées, journaux et participations.
- Prévoir les mécanismes de rectification et de suppression selon les règles applicables au projet.
- Protéger les exports CSV et limiter leur accès aux administrateurs autorisés.

---

## 10. Gestion des erreurs et résilience

### 10.1 API publique indisponible

- Définir un délai maximal par appel.
- Effectuer un nombre limité de nouvelles tentatives uniquement sur les erreurs transitoires.
- Utiliser un cache pour les listes d'events et d'organizations.
 - Ne pas finaliser une validation si l'event ou sa durée maximale ne peuvent pas être vérifiées.
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
 - modification d'un code organization ;
- génération d'un export.

---

## 11. Règles de gestion consolidées

| ID | Règle |
|---|---|
| RG-001 | Une adresse email doit être valide et normalisée avant enregistrement. |
| RG-002 | Un event doit exister dans le référentiel public au moment de la création de la demande et de la validation. |
| RG-003 | Un event ne peut être validé qu'une seule fois pour un même étudiant. |
| RG-004 | Le nombre d'heures doit être compris entre 0 et la durée maximale courante de l'event, bornes incluses. |
| RG-005 | La durée maximale utilisée doit être conservée dans la participation pour audit. |
| RG-006 | Un code organization contient exactement six chiffres. |
| RG-007 | Les zéros initiaux du code organization sont significatifs. |
| RG-008 | Un code actif identifie une seule organization. |
| RG-009 | Le code organization n'est jamais stocké ni affiché en clair après sa création. |
| RG-010 | Une organization désactivée ne peut plus valider un event. |
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

### CA-003 — Consultation des events

Étant donné un étudiant possédant des participations actives, son tableau de bord affiche chaque event, ses heures et le total exact.

### CA-004 — Récupération des events

Lorsque l'étudiant ouvre la modale d'ajout, la liste est récupérée via une Cloud Function et aucun appel direct à l'API publique n'est réalisé par le navigateur.

### CA-005 — Validation depuis le téléphone de l'étudiant

Étant donné un event valide non encore réalisé, lorsque l'étudiant initie une demande, alors l'interface de validation s'affiche sur son téléphone et permet à une personne de l'organization de saisir le code secret pour valider l'event.

### CA-006 — Durée par défaut

Lorsque la page organization est ouverte, le champ d'heures est initialisé avec la durée maximale récupérée pour l'event.

### CA-007 — Réduction des heures

Étant donné une durée maximale de 4 heures, l'organization peut valider 3 heures mais ne peut pas valider 4,25 heures.

### CA-008 — Code organization incorrect

Étant donné un code inconnu ou désactivé, la validation est refusée et aucune participation n'est créée.

### CA-009 — Validation réussie

Étant donné une demande active, un event valide, un code organization correct et une durée autorisée, la participation est créée et la demande passe à l'état `validated` dans une même transaction.

### CA-010 — Prévention des doublons

Étant donné une participation déjà active pour la paire étudiant/event, toute nouvelle validation est refusée, y compris en cas de requêtes simultanées.

### CA-011 — Export CSV

Lorsque l'administrateur exporte les données, le fichier contient uniquement les étudiants et events ayant au moins une participation active, avec les heures à chaque intersection.

### CA-012 — Ajout manuel

Un administrateur peut ajouter une participation manquante avec un motif, sous réserve des règles de validité et d'unicité.

### CA-013 — Suppression manuelle

Lorsqu'un administrateur supprime une participation avec un motif, celle-ci disparaît du tableau étudiant, des totaux et de l'export, mais reste traçable en base.

### CA-014 — Gestion d'un code organization

Un administrateur peut attribuer ou remplacer un code à six chiffres pour une organization du référentiel public. Le code en clair n'est pas récupérable après enregistrement.

### CA-015 — Refus d'accès à l'administration

Un utilisateur non administrateur ne peut ni charger les données administratives ni exécuter une fonction d'administration, même en appelant directement les endpoints.

---

## 13. Points à arbitrer avant développement

1. **Authentification étudiante** : lien magique retiré — simple session basée sur un email déclaré.
2. **Valeur zéro** : confirmer qu'une participation de zéro heure doit pouvoir être enregistrée plutôt que rejetée.
3. **Précision des heures** : heures entières, quarts d'heure ou toute valeur décimale à deux chiffres.
4. **Expiration des demandes de validation** : durée de validité attendue.
5. **Organization et event** : confirmer si toute organization configurée peut valider tout event ou si certaines organizations doivent être limitées à certains events.
6. **Organization affichée à l'étudiant** : confirmer si son nom doit apparaître dans l'historique.
7. **Modification administrative** : confirmer si l'administrateur peut modifier directement une participation ou seulement la supprimer puis la recréer.
8. **Format CSV** : séparateur virgule ou point-virgule, et cellule vide ou `0` en l'absence de participation.
9. **Volume attendu** : nombre d'étudiants et d'events, car une matrice très large peut dépasser les limites pratiques d'Excel.
10. **Contrat des API publiques** : endpoints, authentification, limites de débit, pagination, politique de disponibilité et structure exacte des réponses.
11. **Définition d'un étudiant autorisé** : tout email valide ou uniquement certains domaines et établissements.
12. **Conservation des données** : durées applicables aux participations, demandes expirées, exports et journaux d'audit.

---

## 14. Hors périmètre initial

Sauf demande complémentaire, les éléments suivants ne sont pas inclus :

- création de comptes autonomes pour les organizations ;
- validation automatique sans code organization ;
- application mobile native ;
- notifications automatiques après validation ;
- import massif de participations ;
 - gestion de plusieurs validations partielles pour un même event ;
- système de points ou de récompenses ;
- édition de certificats de bénévolat.
