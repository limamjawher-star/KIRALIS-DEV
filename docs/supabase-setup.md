# KIRALIS — Configuration et historique de la base de données Supabase (Phase 3)

Ce guide documente le schéma PostgreSQL multi-agences de **KIRALIS**, l’état de synchronisation des migrations déjà appliquées manuellement sur la base Supabase réelle, et les règles pour les futures migrations.

---

## 1. Historique des migrations (appliquées vs futures)

| Migration | État sur la base Supabase réelle | Rôle |
| --- | --- | --- |
| `supabase/migrations/202611210001_initial_schema.sql` | **Appliquée manuellement** *(ne pas réexécuter)* | Extensions (`pgcrypto`, `btree_gist`), enums, 6 tables multi-agences, clés étrangères composites, contrainte GiST anti-chevauchement, triggers d’intégrité |
| `supabase/migrations/202611210002_rls_and_functions.sql` | **Appliquée manuellement** *(ne pas réexécuter)* | Privilèges minimaux, fonctions RLS (`is_active_agency_member`, `has_agency_role`), RPC `create_agency(...)`, activation et forçage du RLS sur les 6 tables |
| `supabase/migrations/202611210003_security_lockdown.sql` | **Appliquée manuellement (synchronisée dans le dépôt)** *(ne pas réexécuter)* | Verrouillage de sécurité additif et non destructif : blocage `INSERT` sur `audit_logs` et `agency_memberships`, blocage `UPDATE` direct sur `reservations`, révocation de l’ancien RPC `record_audit_log`, réaffirmation des droits `EXECUTE` sur `create_agency` et les helpers RLS |
| `supabase/migrations/202611210004_*.sql` et suivantes | **Futures migrations (à venir)** | Toute évolution ultérieure (Phase 4+ / Phase 5+) devra être strictement additive, sans suppression de tables ni perte de données |

> **Règle de gestion des migrations :** Ne modifiez plus les migrations déjà exécutées manuellement sur la base distante (`0001` à `0003`) pour déployer des changements sur la base existante. Toute évolution future doit passer par une nouvelle migration additive numérotée (`0004` et suivantes).

---

## 2. Architecture et posture de sécurité actuelle

### Les 6 tables confirmées en base
- `public.agencies` — Profil et paramètres régionaux d’une agence (`TND`, 3 décimales, `Africa/Tunis`, TVA en bps)
- `public.agency_memberships` — Appartenance Supabase Auth (`owner`, `manager`, `agent` ; statuts `active`, `invited`, `suspended`)
- `public.vehicles` — Parc automobile avec clé composite `(agency_id, id)` et tarifs en millimes (`bigint`)
- `public.customers` — Clients particuliers et entreprises avec clé composite `(agency_id, id)`
- `public.reservations` — Réservations avec clés étrangères composites `(agency_id, vehicle_id)` et `(agency_id, customer_id)`, montants exacts en millimes et contrainte GiST anti-chevauchement (`confirmed` / `active`)
- `public.audit_logs` — Journal d’audit immuable par agence (lecture seule `owner`/`manager`)

### Verrouillage de sécurité confirmé (`202611210003_security_lockdown.sql`)
Les quatre contrôles de privilèges suivants ont été confirmés à `false` pour `authenticated` sur la base Supabase réelle :
- `can_insert_audit_logs = false` — Aucun client authentifié ne peut forger d’entrée dans `public.audit_logs`.
- `can_insert_memberships = false` — Aucun client authentifié ne peut ajouter ou activer directement un membre (les invitations d’équipe seront ajoutées ultérieurement avec un flux d’acceptation dédié).
- `can_update_reservations = false` — Aucune mise à jour directe non contrôlée sur `public.reservations` en attente des flux métier serveur.
- `can_execute_audit_rpc = false` — Aucun RPC client arbitraire de création d’audit n’est exécutable.

### Droits préservés pour l’onboarding Supabase Auth (Phase 4)
- `authenticated` conserve `EXECUTE` sur `public.create_agency(...)`, `public.is_active_agency_member(uuid)` et `public.has_agency_role(uuid, public.agency_role[])`.
- `authenticated` conserve `SELECT` sur `public.agencies` et `public.agency_memberships` (filtrés par RLS) ainsi que `UPDATE` sur `public.agencies` pour les `owner` actifs.
- `anon` et `PUBLIC` restent totalement privés d’accès aux tables et aux fonctions métier.
- Aucune clé secrète / `service_role` n’est utilisée : seules `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sont requises.

---

## 3. Requêtes de vérification en lecture seule (Supabase SQL Editor)

Pour revérifier à tout moment l’état des privilèges sur la base distante sans modifier de données :

```sql
SELECT
  has_table_privilege('authenticated', 'public.audit_logs', 'INSERT') AS can_insert_audit_logs,
  has_table_privilege('authenticated', 'public.agency_memberships', 'INSERT') AS can_insert_memberships,
  has_table_privilege('authenticated', 'public.reservations', 'UPDATE') AS can_update_reservations,
  CASE
    WHEN to_regprocedure('public.record_audit_log(uuid,text,text,uuid,jsonb)') IS NULL THEN false
    ELSE has_function_privilege('authenticated', 'public.record_audit_log(uuid,text,text,uuid,jsonb)', 'EXECUTE')
  END AS can_execute_audit_rpc,
  has_function_privilege(
    'authenticated',
    'public.create_agency(text,text,text,text,text,text,text,text,text,text,smallint,text,text,integer)',
    'EXECUTE'
  ) AS can_execute_create_agency,
  has_function_privilege(
    'anon',
    'public.create_agency(text,text,text,text,text,text,text,text,text,text,smallint,text,text,integer)',
    'EXECUTE'
  ) AS anon_can_execute_create_agency;
```

Résultat attendu :
- `can_insert_audit_logs` = `false`
- `can_insert_memberships` = `false`
- `can_update_reservations` = `false`
- `can_execute_audit_rpc` = `false`
- `can_execute_create_agency` = `true`
- `anon_can_execute_create_agency` = `false`

---

## 4. Installation sur un nouvel environnement vierge (développement / staging)

Uniquement si vous initialisez un **nouveau projet Supabase vide** (et jamais en réexécutant sur une base déjà initialisée) :
1. `supabase/migrations/202611210001_initial_schema.sql`
2. `supabase/migrations/202611210002_rls_and_functions.sql`
3. `supabase/migrations/202611210003_security_lockdown.sql`
4. *(Optionnel, transactionnel avec `ROLLBACK`)* `supabase/tests/rls_verification.sql`
