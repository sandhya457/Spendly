# Spendly — Project study and defense guide

This guide is written for a **second-semester web development project**. You can demonstrate Spendly using normal web concepts without needing React, complicated cloud services, or an external framework.

## 1. Problem and solution

Students regularly spend money on transport, food, study materials and entertainment. Manual tracking makes it difficult to see how much is left.

**Spendly** solves that by allowing every registered user to enter money received, record expenses, plan budgets and goals, and reserve some of the available money in named savings vaults.

The project is a _money management tracker_. It is not a wallet linked to a bank, and it never moves real money.

## 2. The five technical layers

| Layer           | File(s)                            | What it does                                                                         |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| Structure       | `*.html`                           | Renders forms, tables, cards, navigation and page content                            |
| Styling         | `css/style.css`, `css/refined.css` | Controls typography, spacing, colors, dark mode and mobile layout                    |
| Client behavior | `js/app.js` and per-page scripts   | Handles clicks, validates form inputs, draws charts, calls APIs, updates DOM         |
| Server logic    | `api/index.php`, `api/store.php`   | Handles sessions, validation, data access, authentication and errors                 |
| Database        | `api/schema.sql`                   | Stores user accounts, profiles, expenses, income, savings, budgets and vault ledgers |

**Why vanilla JavaScript?** The project demonstrates core browser features, objects, arrays, promises, Fetch API, events and DOM manipulation directly. It is easier to explain than a large framework in an early-semester defense.

## 3. How the frontend connects to the backend

### Login

1. `login.html` shows email and password fields.
2. `js/login.js` first requests `GET api/index.php?action=session` to obtain the CSRF token.
3. On submit, it sends `POST api/index.php?action=login` with a JSON object.
4. PHP checks the email in the `users` table and uses `password_verify` on the stored hash.
5. On success, PHP regenerates the session identifier and stores the user ID in the server session.
6. The browser navigates to the dashboard.

### Loading user finance data

1. A protected page loads `js/app.js`.
2. The script checks the current server session, then calls `GET api/index.php?action=data`.
3. `api/store.php` uses parameterized SQL queries to read the signed-in user's rows from their respective tables.
4. PHP returns a JSON object with `profile`, `expenses`, `incomes`, `budget`, `goals`, `categories` and `settings`.
5. JavaScript renders totals, progress bars, tables and charts.

### Saving an expense

1. `add-expense.html` accepts the category, date, description and amount.
2. `js/add-expense.js` checks the values and updates a copy of the loaded data object.
3. `Spendly.saveData()` sends that object plus a revision number using an HTTP PUT request.
4. PHP validates the data and checks the revision in the database.
5. A MySQL transaction updates normalized financial tables, the compatibility snapshot and its revision.
6. The API responds with success; the client updates its saved view.

The **revision number** prevents one old tab from silently overwriting another tab's changes.

## 4. Database relationships

Each user has many expenses, income records, categories, goals, vaults and vault transactions.

```text
users (id PK)
 ├── user_profiles (user_id PK/FK)
 ├── user_data (user_id PK/FK, payload JSON, version)
 ├── categories (user_id + name PK)
 │    ├── category_budgets (user_id + category PK/FK)
 │    └── expenses (user_id + id PK, category FK)
 ├── incomes (user_id + id PK)
 ├── monthly_budgets (user_id PK/FK)
 ├── saving_goals (user_id + id PK)
 ├── finance_preferences (user_id PK/FK)
 └── vaults (id PK, user_id FK)
      └── vault_transactions (id PK, vault_id FK)
```

**Primary keys** uniquely identify records. **Foreign keys** connect related rows and stop orphaned data. `ON DELETE CASCADE` removes a deleted account's dependent rows.

Financial amounts use `DECIMAL(12,2)` in MySQL to avoid storing money as approximate floating-point values.

## 5. Vault logic

Suppose a user has recorded NPR 10,000 income and NPR 3,000 expenses. Their recorded net balance is NPR 7,000.

If they deposit NPR 2,000 into a personal vault:

- Recorded net balance remains NPR 7,000.
- Vault balance becomes NPR 2,000.
- **Available to allocate/spend** becomes NPR 5,000.

Withdrawing NPR 500 from the vault changes vault balance to NPR 1,500 and available funds to NPR 5,500. This is an accounting allocation only.

The server checks ownership, availability and sufficient vault balance. Updates to the balance and transaction history happen inside a MySQL transaction.

## 6. Security concepts used

- Passwords are stored as password hashes, not readable plain text.
- PHP sessions identify authenticated users; a browser alone cannot grant access.
- The CSRF token must accompany data-changing API requests.
- Server-side input validation is used even when HTML form validation exists.
- Prepared PDO statements reduce SQL injection risks.
- A user ID from the session scopes all private SQL records.
- Login email changes require the current password.
- Account deletion also requires password confirmation.
- Expensive actions use database transactions and foreign keys.

**Important limitation:** There is no verified email recovery, email verification, two-factor authentication, or bank transfer integration. The project demonstrates core web development but is not professionally audited for public financial use.

## 7. Typical project defense questions

**Q: Which languages did you use?**

A: HTML and CSS for presentation, JavaScript for browser behavior, PHP for server endpoints, and SQL for the database.

**Q: Why do we need a backend?**

A: Browser JavaScript alone cannot safely verify a user's password or protect their private database records. PHP performs those operations on the server.

**Q: What is a session?**

A: A server-side record that connects an authenticated user to their later requests.

**Q: Why use a foreign key?**

A: To ensure financial records belong to an existing user or category and to preserve relational consistency.

**Q: What is a prepared statement?**

A: A SQL command that separates query structure from user-supplied data, reducing SQL injection risks.

**Q: What is an API?**

A: A server interface that receives requests such as login, data reads and updates and returns JSON responses.

**Q: Why use a transaction for a vault deposit?**

A: Both the vault balance and its history must change together. If one update fails, the transaction is rolled back.

**Q: What happens if two browser tabs save at once?**

A: The version check rejects a stale save with HTTP 409 so the user can refresh rather than overwrite newer data.

**Q: How is an expense report generated?**

A: The page filters the expense array, groups values by category and calculates totals for a chart and table.

**Q: What would you improve after the semester project?**

A: Email verification and recovery, stronger login rate limits, automated browser tests, better reporting, and a professional security review.

## 8. Demonstration checklist

1. Show the Home, Features and About pages.
2. Create a user using Sign Up and sign in.
3. Enter an income and expense.
4. Edit the expense from Reports, use the filters and export a CSV.
5. Set monthly and category budgets.
6. Add a savings goal and update its progress.
7. Create a vault, deposit some of the available money and withdraw a portion.
8. Update your profile and email; demonstrate how the password is verified.
9. Refresh the browser to show persistence.
10. Sign in with another account and demonstrate that financial data is separate.

Always test the demonstration with temporary accounts and non-sensitive example figures.
