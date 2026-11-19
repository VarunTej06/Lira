# Azure playground rehearsal

A dress rehearsal on a temporary Azure sandbox (the KodeKloud playground), done by hand, to learn what works before the real subscription is bought. **Nothing here is the product.** The sandbox lasts about two hours, is in US regions, and everything in it is deleted afterwards.

## Rules

- No real data and no real user. Use the sample rows in the SQL below.
- No password, connection string or key goes into this repository, a chat, a log or a screenshot. Keep them in a password manager for the session.
- The firewall rule that lets your computer in, and the public address of the web app, exist only for the rehearsal. The real service uses private networking.
- What carries over is **this document, the SQL, and your notes**. The Azure resources do not.

## Limits of the sandbox (from its own page)

PostgreSQL: Burstable only (Standard_B1ms or B2s), 32 GB, no storage autogrow, backups at most 7 days and not geo-redundant, no high availability, no availability zone, one server per session. The page says you cannot create resource groups, buy from the marketplace, see billing, or change role assignments; the owner found that creating a resource group does work, so try each and write down what is allowed. Regions: West, East, Central and South Central US.

## Plan (about two hours)

| Step | What | Time |
|---|---|---|
| 1 | Create the PostgreSQL server | 20 min |
| 2 | Connect to it from your computer | 10 min |
| 3 | Run the schema and the isolation tests | 30 min |
| 4 | Key Vault: store and read back a test secret | 15 min |
| 5 | Put the hosted build on App Service | 30 min |
| 6 | Write down what happened | 10 min |

Do step 3 before anything else that is optional: it tests the rule that matters most, that one organisation can never read another's data.

## Step 1. PostgreSQL

Portal, **Azure Database for PostgreSQL flexible servers**, **Create**.

- Resource group: one you create (for example `rg-lira-rehearsal`), or the one the playground gave you.
- Region: any allowed one. Workload type: Development.
- PostgreSQL version: 16.
- Compute: Burstable, Standard_B1ms. Storage: 32 GiB, **autogrow off**.
- Backup retention 7 days, **geo-redundancy off**. High availability **off**. Availability zone: **no preference**.
- Authentication: PostgreSQL authentication. Admin user `lirasadmin`, and a long random password kept in your password manager.
- Networking: public access, and add your current client IP as a firewall rule. Require SSL (the default).

Wait until the server shows as **Available**. Note the server name (`<name>.postgres.database.azure.com`).

## Step 2. Connect

Install the PostgreSQL client tools (`psql`) on your computer, then:

```
psql "host=<name>.postgres.database.azure.com port=5432 dbname=postgres user=lirasadmin sslmode=require"
```

Check that the connection is encrypted: `SHOW ssl;` should say `on`. If it cannot connect, check the firewall rule and your IP first.

## Step 3. Schema and isolation tests

**Quick way:** `rehearsal-isolation-test.sql` in this folder creates everything below and checks all nine results itself, printing PASS or stopping with FAIL. From Ubuntu (WSL), with the admin password in `PGPASSWORD` (read it from Key Vault, never type it into a file):

```
read -rs PGPASSWORD; export PGPASSWORD
docker run --rm -it -e PGPASSWORD -v /mnt/d/MLOps_LLMOps/Lira/docs/03-sop:/sql postgres:16   psql "host=<server>.postgres.database.azure.com port=5432 dbname=postgres user=lirasadmin sslmode=require" -f /sql/rehearsal-isolation-test.sql
```

The blocks below are the same SQL, to read and to run by hand.



Create a database for the test, connect to it, and run the blocks below one at a time. The last column says what you must see.

```sql
CREATE DATABASE lira_rehearsal;
\c lira_rehearsal
```

### 3a. Roles and tables

```sql
-- The application never owns the tables and is never a superuser, so it cannot switch the protection off.
CREATE ROLE lira_app NOLOGIN;

CREATE TABLE organisations (
  id   uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE users (
  id            uuid PRIMARY KEY,
  email         text NOT NULL,
  password_hash text NOT NULL            -- an Argon2id hash made by the application; the database never sees a password
);
CREATE UNIQUE INDEX users_email_lower ON users (lower(email));

CREATE TABLE memberships (
  org_id  uuid NOT NULL REFERENCES organisations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role    text NOT NULL CHECK (role IN ('owner','admin','manager','member','viewer','guest')),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE tickets (
  id         uuid PRIMARY KEY,
  org_id     uuid NOT NULL REFERENCES organisations(id),
  key        text NOT NULL,
  title      text NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only: the application may add rows and read them, never change or delete them.
CREATE TABLE audit_log (
  id       bigserial PRIMARY KEY,
  org_id   uuid NOT NULL REFERENCES organisations(id),
  actor    uuid,
  action   text NOT NULL,
  at       timestamptz NOT NULL DEFAULT now()
);
```

### 3b. Sample data (two organisations)

```sql
INSERT INTO organisations VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Org A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Org B');

INSERT INTO tickets (id, org_id, key, title) VALUES
  ('a1a1a1a1-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'A-1', 'Org A ticket one'),
  ('a2a2a2a2-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'A-2', 'Org A ticket two'),
  ('b1b1b1b1-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'B-1', 'Org B ticket one');
```

### 3c. Switch the protection on

```sql
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE  ROW LEVEL SECURITY;

-- A row is visible and writable only when it belongs to the organisation the application named for this transaction.
CREATE POLICY tenant ON tickets
  USING      (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON tickets TO lira_app;
GRANT SELECT, INSERT ON audit_log TO lira_app;
GRANT USAGE ON SEQUENCE audit_log_id_seq TO lira_app;
GRANT SELECT ON organisations, memberships, users TO lira_app;
```

### 3d. The tests

Run each one. `SET LOCAL` lasts for one transaction, which is how the application will name the organisation on a pooled connection.

| # | Run | You must see |
|---|---|---|
| 1 | `BEGIN; SET LOCAL ROLE lira_app; SET LOCAL app.org_id = 'aaaaaaaa-0000-0000-0000-000000000001'; SELECT key FROM tickets ORDER BY key; COMMIT;` | `A-1`, `A-2` only |
| 2 | `BEGIN; SET LOCAL ROLE lira_app; SET LOCAL app.org_id = 'bbbbbbbb-0000-0000-0000-000000000002'; SELECT key FROM tickets; COMMIT;` | `B-1` only |
| 3 | `BEGIN; SET LOCAL ROLE lira_app; SELECT count(*) FROM tickets; COMMIT;` (no organisation named) | `0` |
| 4 | As A, read B's ticket by its id: `... SET LOCAL app.org_id = 'aaaa...0001'; SELECT * FROM tickets WHERE id = 'b1b1b1b1-0000-0000-0000-000000000001'; ...` | no rows |
| 5 | As A, try to write into B: `... INSERT INTO tickets (id, org_id, key, title) VALUES (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000002', 'B-9', 'planted');` | error: new row violates row-level security policy |
| 6 | As A, `UPDATE tickets SET title = 'x' WHERE key = 'B-1'; DELETE FROM tickets WHERE key = 'B-1';` | `UPDATE 0` and `DELETE 0` |
| 7 | As `lira_app`: `ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;` | error: must be owner of table tickets |
| 8 | As `lira_app`: `INSERT INTO audit_log (org_id, action) VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'test');` | `INSERT 0 1` |
| 9 | As `lira_app`: `UPDATE audit_log SET action = 'x';` and `DELETE FROM audit_log;` | error: permission denied for table audit_log |

Write down every result, including any that differ. A difference is the point of the rehearsal.

## Step 4. Key Vault

Create a Key Vault in the same resource group. Add a secret named `rehearsal-secret` with a made-up value, then read it back in the portal. The sandbox may block role assignments; if reading is denied, write down the exact message and move on.

## Step 5. The hosted build on App Service

On your computer, from `lira-app/`:

```
npm run build:hosted
```

Zip the **contents** of `dist/` (not the folder itself). In the portal create an **App Service**: Linux, runtime Node 20 LTS, the smallest plan allowed. Then:

1. Configuration, General settings, **Startup command**: `pm2 serve /home/site/wwwroot --no-daemon --spa`.
2. Settings, **HTTPS Only: On**, minimum TLS 1.2.
3. Upload the zip with the Kudu page `https://<app>.scm.azurewebsites.net/ZipDeployUI`.
4. Open `https://<app>.azurewebsites.net/`. You should see the landing page. Check `/login`, `/signup`, `/terms`, and refresh on each (a refresh must not give "not found").

The app holds no data, only the built pages, so it is safe to leave public for the session. **Delete it** when you finish.

## Step 6. Notes to write down

For each step: what worked, what you had to change, exact menu names that differ from this page, how long it took, and any error text. Add them to a short results table below this one, with the date. These notes decide the real plan.

## Part B. The web container, and liraspaces.com

This replaces step 5 when Container Apps works. The image is built from `lira-app/Dockerfile` (nginx serving the hosted build, with the security headers, `/health` and `/ready`). You do not need Docker on your computer: Azure builds the image.

Which service: **Container Apps** is closest to the real design (a server container that can scale to zero), so use it first. **App Service** (step 5) is the fallback. **Container Instances** is not recommended: it has no managed certificate or custom domain on its own.

From `lira-app/`, after `az login` with the playground account:

```
az group create -n rg-lira-rehearsal -l eastus
az containerapp env create -n lira-env -g rg-lira-rehearsal -l eastus
az containerapp up -n liraspaces-web -g rg-lira-rehearsal --environment lira-env --source . --ingress external --target-port 8080
```

`containerapp up --source .` makes a registry, builds the Dockerfile in Azure, and deploys it. If a command says a resource provider is not registered, register `Microsoft.App`, `Microsoft.OperationalInsights` and `Microsoft.ContainerRegistry`, and try again. If the build step is blocked, write the exact message down and use step 5 instead.

Check the address Azure prints: `/` shows the landing page, `/health` says `ok`, `/login` and `/app` load after a refresh. Open the browser console on `/` and `/app` and look for red "Content Security Policy" lines: the policy is strict (the page may only talk to itself), and the app under `/app` has not been tried behind it.

### When the sandbox blocks the registry build

In the playground, `az acr build` and `az containerapp up --source` were denied (`scheduleRun`), and a new resource group could not be created. The way around it is to build on GitHub:

1. Commit and push the repository (it needs `lira-app/Dockerfile`, `lira-app/nginx.conf`, `lira-app/.dockerignore` and `.github/workflows/web-image.yml`).
2. Enable the registry's admin user: `az acr update -n <registry> --admin-enabled true`.
3. In GitHub, Settings, Secrets and variables, Actions, add `ACR_LOGIN_SERVER`, `ACR_USERNAME` and `ACR_PASSWORD` from the registry (Azure portal, the registry, **Access keys**). The password goes only into that GitHub page.
4. Actions, **Build web image**, **Run workflow**. The runner builds the Dockerfile and pushes `liraspaces-web` to the registry.
5. Point the container app at the image and the nginx port: `az containerapp update -n liraspaces-web -g <rg> --image <registry>.azurecr.io/liraspaces-web:latest --target-port 8080` with the registry login.

The workflow runs only when started by hand, takes the login from secrets, and can read the repository only. On the real subscription it is replaced by a workflow that signs in with OIDC, so no password is stored in GitHub. Container Apps also has its own **Continuous deployment** page that connects a GitHub repository; it creates an Azure identity and a role assignment, which the playground is expected to refuse.

### Pointing liraspaces.com at it

Use a **subdomain first**, `test.liraspaces.com`, so the main address is never touched.

1. Container Apps, your app, **Custom domains**, **Add custom domain**, choose a **managed certificate** (free), and enter `test.liraspaces.com`. Azure shows a CNAME target (`<app>.<env>.<region>.azurecontainerapps.io`) and a TXT value for `asuid.test`.
2. In Hostinger, the domain `liraspaces.com`, **DNS records**, add:
   - TXT: name `asuid.test`, value from Azure.
   - CNAME: name `test`, target the CNAME target from Azure.
   - Short TTL (300 seconds) so changes show quickly.
3. Back in Azure press **Validate**, then **Add**. The certificate can take several minutes. Then open `https://test.liraspaces.com/`.
4. Only when that works, try the main address `liraspaces.com`: Azure shows an A record (the environment's address) and the TXT record `asuid`. Hostinger may have default records on the main name that must be removed first.

**When you finish, delete the DNS records you added.** A CNAME that still points at a deleted `azurecontainerapps.io` name can be claimed by someone else, who would then serve their page on your domain (a subdomain takeover). Delete the record first, the Azure resources after.

## Where the AI model token lives

| Where | How |
|---|---|
| Now, on your computer | Settings, Viva, in the app. The local server saves it in `data/private/secrets.json`, which git ignores. Never in code, the repository, a chat, a screenshot or a log. |
| Your own copy | A password manager. |
| The rehearsal | Store it as a Key Vault secret (step 4), and, if you want to practise, give the container app a managed identity with the role **Key Vault Secrets User** and reference the secret from an environment variable. The web container does not use it. |
| The real hosted service | The same pattern: a Key Vault secret, read by the **server** through a managed identity, never by the browser. The server calls the model and the browser only sees the answer. |
| What the browser must never hold | The token. Today the local app calls the model from the browser, which is acceptable only on your own computer. The hosted edition must route Viva through the server, from an allow-list of providers the admin chose. |

Tokens in a playground expire with the session, so treat them as practice keys: do not build anything that depends on one.

## What changes on the real subscription

| Here | Real |
|---|---|
| US region | Central India (or South India) |
| Public access and a firewall rule for your IP | Private endpoint inside a virtual network |
| Password sign-in for the admin | Microsoft Entra sign-in, and a managed identity for the application |
| No high availability, 7-day backup | High availability, geo-redundant backup, longer retention |
| Burstable B1ms | Sized from real use |
| Manual clicking | Terraform, so the setup can be repeated |
| No billing view | A budget and alerts, set before anything else |

## Results (fill in during the session)

| Step | Worked? | Notes (time, errors, settings that differed) |
|---|---|---|
| Sign in with `az login` | Yes | Lab user. CLI 2.88, `containerapp` extension is preview. The three resource providers were already registered. |
| New resource group | **No** | `AuthorizationFailed` on `resourcegroups/write`. Use the one given (`kml_rg_main-...`, East US). |
| Container registry (Basic) | Yes | Created in the given group. |
| Registry cloud build (`az acr build`, `containerapp up --source`) | **No** | `AuthorizationFailed` on `registries/scheduleRun/action`. Built with Docker in Ubuntu (WSL) and pushed with `docker push` using the registry admin user instead. |
| Container Apps environment | Yes, with limits | Policy: the name must be `container-app-env`, Consumption profile, no zone redundancy. Created with `--logs-destination none`; the default Log Analytics workspace was denied by policy. |
| Container app | Yes, with limits | Policy: min replicas 0 or 1, max 0, 1 or 2. External ingress works. Sample image first, then our image on target port 8080. |
| Our web image | Yes | nginx serves `/`, `/login`, `/signup`, `/app`, `/terms` (200), `/health` and `/ready` (200), security headers present, one-year cache on built files. The first request after a revision change times out (scale to zero), later ones are fast. |
| Custom domain `test.liraspaces.com`, DNS | Yes | CNAME `test` and TXT `asuid.test` in Hostinger. A typo (`suid.test`) delayed it; public resolvers kept the old "not found" for a few minutes. Hostname added to the app; plain HTTP redirects to HTTPS. |
| Certificate for the custom domain | **No** | Managed certificate (CLI and portal) and an uploaded certificate were all denied by policy ("Non-compliant with policy standards for Azure_playground"). So HTTPS on the custom name cannot be shown in this sandbox. Test it on the real subscription. |
| PostgreSQL, isolation tests, Key Vault | Not done in this session | |
