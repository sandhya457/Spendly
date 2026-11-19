# Spendly — setup, migration and deployment

This version uses PHP 8.1+, PDO MySQL, Apache, and MySQL 8 / MariaDB. It requires a PHP server, NOT the VS Code Live Server extension.

## A. Install locally with WAMP64

1. Place the repository in `C:\wamp64\www\spendly` (or your configured Apache document root).
2. Start **Apache and MySQL**. Ensure WAMP64 shows green.
3. Open phpMyAdmin at `http://localhost/phpmyadmin/`.
4. Create the database (if it does not exist):

   ```sql

   ```

CREATE DATABASE IF NOT EXISTS spendly CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

````

5. Select the `spendly` database, choose **Import**, and import `api/schema.sql`.
6. Verify PHP has the PDO MySQL extension.
7. Open `http://localhost/spendly/` and create an account.

Do **not** open `file:///.../index.html` and do not use port 5500 from Live Server: those cannot execute the PHP API.

## B. Existing Spendly databases

The schema uses `CREATE TABLE IF NOT EXISTS`. Import it again to add the new relational and vault tables; it does not intentionally drop user records. **Back up your database before running SQL on a populated server.**

On their next authenticated data request, users who still have the earlier JSON-only data will be migrated into the dedicated profile, category, expense, income, budget, goal and preference tables. Their saved financial information is preserved, and the JSON snapshot remains a compatibility backup and revision counter.

**Do not remove the `user_data` table**. It is still used for concurrency checks and vault allocation calculations.

## C. Database configuration

Set environment variables on the Apache/PHP process. The local WAMP defaults are for development only.

| Variable | Local default |
| --- | --- |
| `SPENDLY_DB_HOST` | 127.0.0.1 |
| `SPENDLY_DB_PORT` | 3306 |
| `SPENDLY_DB_NAME` | spendly |
| `SPENDLY_DB_USER` | root |
| `SPENDLY_DB_PASSWORD` | empty |

Never commit production secrets. Create a dedicated MySQL account rather than using root in production.

To run PHP's local dev server from PowerShell:

```powershell
$env:SPENDLY_DB_NAME = 'spendly'
$env:SPENDLY_DB_USER = 'root'
$env:SPENDLY_DB_PASSWORD = ''
php -S 127.0.0.1:8000 -t .
````

Visit `http://127.0.0.1:8000/`. PHP's built-in server is **development-only**.

## D. Verify the installation

1. Visit `/api/index.php?action=session`. It must return JSON with `authenticated` and a CSRF token.
2. Create two test accounts. Verify they have separate expenses and vaults.
3. Record NPR 5,000 as income, NPR 200 as an expense.
4. Create a Savings Vault. Deposit NPR 1,000 and withdraw NPR 300.
5. Reload the app. Confirm your data persists in MySQL.
6. Change your login email using your current password, log out, and log in with the new email.
7. Export your account and verify its JSON records.
8. Test responsiveness at a narrow mobile screen.

When running automated tests against a **throwaway database**:

```bash
SPENDLY_BASE_URL=http://127.0.0.1:8000 python3 tests/smoke.py
```

This script creates test accounts and records. Do not run it against a live production database.

## E. How finances and vaults work

- Total income minus expenses is the recorded account balance.
- Savings vault deposits reserve a portion of that recorded balance, so the dashboard's **available** amount is income minus expenses minus currently allocated vault money.
- Vault withdrawals return the allocation to the available amount. No real transfer or payment occurs.
- Deposits cannot exceed the available amount at the moment of deposit.
- Savings goals are planning indicators and are not automatically linked to a vault.
- Each vault has a history in `vault_transactions` and is owned by a single user.
- You must withdraw a vault's remaining balance before archiving it or resetting the underlying financial history.

## F. Deployment checklist

- Use paid/shared hosting or a VPS that runs PHP 8.1+ and MySQL/MariaDB; static hosts such as GitHub Pages cannot run this backend.
- Use HTTPS, a dedicated database user, and strong MySQL credentials.
- Import `api/schema.sql` and confirm the host permits PHP sessions.
- Disable verbose PHP error display on production; enable secure server-side logs.
- Restrict public access to SQL and environment/configuration files. Apache `.htaccess` rules are included, but test that your host honors them.
- Configure automated database backups and document the data retention policy.
- Review session cookie behavior, server time, file permissions, error handling and account deletion on actual hosting.
- Test with a fresh account and with a migrated existing account, on desktop and mobile.
- Public deployment to untrusted users should include a proper account recovery flow, email verification, improved rate limiting and additional security assessment.

## G. API overview

All JSON API calls use `api/index.php?action=...`, same-origin PHP session cookies and CSRF headers for state changes.

| Method    | Action                        | Function                                             |
| --------- | ----------------------------- | ---------------------------------------------------- |
| GET       | session                       | Current login and CSRF token                         |
| POST      | register, login, logout       | Authentication                                       |
| GET / PUT | data                          | Read/save normalized user data; optimistic revisions |
| POST      | change-email, change-password | Verify current password before update                |
| GET       | export-account                | User data and full vault history                     |
| POST      | delete-account                | Permanently delete an authenticated account          |
| POST      | reset-data                    | Reset finance records if vaults are empty            |
| GET       | vaults                        | Active savings vaults and recent movements           |
| POST      | vault-create, vault-update    | Vault details                                        |
| POST      | vault-action                  | Deposit or withdraw an allocation                    |
| POST      | vault-archive                 | Archive an empty vault                               |

## H. Limitations

This is an educational personal finance project, not a banking platform. No password reset by email, mail verification, OAuth, two-factor authentication, external payment integration, or automatic email notifications are implemented. A successful GitHub Actions check verifies a limited set of behaviors, not total production readiness.
