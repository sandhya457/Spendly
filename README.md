# Spendly — Student finance manager

Spendly is a **second-semester web development project** demonstrating real-world HTML, CSS, JavaScript, PHP and relational MySQL. It is designed to be understandable, presentable, and useful without a complicated framework.

The interface uses a responsive pink-and-neutral visual system with DM Sans and Manrope. Money is displayed in **Nepalese Rupees (NPR)**.

## Features

- **Accounts:** register, log in/out, edit profile and avatar, change login email with current password, change password, delete account, download your data.
- **Income & expenses:** add, list, and remove records with dates, amounts, sources and categories.
- **Budget:** monthly total and custom category limits, dashboard progress and in-app alerts.
- **Reports:** spending by category, history, CSV export.
- **Savings goals:** targets and progress (planning-only).
- **Savings vaults:** multiple vaults with targets, deposits, withdrawals, balances, transaction history and archiving. Vaults are _accounting envelopes_, not bank accounts.
- **Appearance:** mobile navigation, dark mode and a consistent UI on all public and signed-in pages.
- **About:** project description and developer portraits, with no separate Our Team page.

## Technology

| Layer          | Stack                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Pages          | Semantic HTML5                                                        |
| Styling        | CSS3 + a shared responsive design system                              |
| Interactivity  | Vanilla JavaScript (fetch, forms, charts, DOM)                        |
| Authentication | PHP sessions, password hashing, CSRF tokens                           |
| API            | PHP 8.1+ JSON endpoints                                               |
| Storage        | MySQL 8 / MariaDB, PDO prepared statements                            |
| Quality checks | GitHub Actions, PHP lint, Node syntax checks, Python HTTP smoke tests |

## Database entities

- **users** — identity, unique login email, password hash.
- **user_profiles** — contact and academic profile, avatar.
- **incomes, expenses** — individual transaction records.
- **categories, monthly_budgets, category_budgets** — expense classification and limits.
- **saving_goals** — goals and planned progress.
- **finance_preferences** — dark mode and budget alerts.
- **vaults, vault_transactions** — money allocations with histories.
- **user_data** — synchronized legacy snapshot and revision counter for safe migration and concurrent edit detection.

Records are scoped to each authenticated user. Existing JSON records are migrated into normalized tables when the account next loads.

## Run locally

Use **WAMP64, XAMPP or Apache with PHP and MySQL**. This is not a static Live Server project.

1. Place this repository under the Apache web root.
2. Create a MySQL database called `spendly`.
3. Import `api/schema.sql` (safe to rerun for new tables).
4. Set database environment variables if your MySQL credentials differ from local defaults.
5. Open `http://localhost/spendly/` and register a test user.

Detailed setup, migration and deployment requirements: **[SETUP.md](SETUP.md)**.

## Understanding the code

- `api/index.php`: authentication, account and vault endpoints.
- `api/store.php`: SQL-backed record storage, one-time migration, database transactions.
- `api/schema.sql`: relational tables, primary/foreign keys.
- `js/app.js`: shared login bootstrap, API client, navigation and currency helpers.
- `js/*.js`: small controllers for each page.
- `css/style.css` and `css/refined.css`: global styling and the upgraded visual system.
- `tests/smoke.py`: test signup, data, vaults and user account flows.

See **[PROJECT_GUIDE.md](PROJECT_GUIDE.md)** for an architecture walkthrough and semester project defense pointers.

## Important limits

Spendly does **not** connect to banks or transfer real funds. There is no working password-reset email, email verification, two-factor authentication, Google/Apple OAuth, or email notifications. Do not advertise those features. Passing automated tests does not mean a public deployment has undergone a professional security audit. Verify HTTPS, server configuration, data protection and real-browser behavior before public launch.
