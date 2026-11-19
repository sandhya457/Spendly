-- Run once after creating the spendly database (utf8mb4).
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_data (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  payload JSON NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT spendly_user_data_fk FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Each vault belongs to one authenticated user. Money is tracked in NPR;
-- no bank transfer is made by this educational application.
CREATE TABLE IF NOT EXISTS vaults (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  target_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  current_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  archived TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vault_owner (user_id, archived),
  CONSTRAINT fk_vault_owner FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vault_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  vault_id BIGINT UNSIGNED NOT NULL,
  kind ENUM('deposit','withdraw') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  note VARCHAR(200) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vault_transactions (user_id, vault_id, created_at),
  CONSTRAINT fk_vault_transaction_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_vault_transaction_vault FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Normalized financial tables. user_data remains a synchronized compatibility
-- snapshot and optimistic version counter, never the primary query source.
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  student_id VARCHAR(60) NOT NULL DEFAULT '',
  course VARCHAR(120) NOT NULL DEFAULT '',
  study_year VARCHAR(30) NOT NULL DEFAULT '',
  avatar MEDIUMTEXT NULL,
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(50) NOT NULL,
  color CHAR(7) NOT NULL,
  symbol VARCHAR(4) NOT NULL,
  PRIMARY KEY(user_id, name),
  CONSTRAINT fk_category_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expenses (
  user_id BIGINT UNSIGNED NOT NULL,
  id BIGINT UNSIGNED NOT NULL,
  transaction_date DATE NOT NULL,
  category VARCHAR(50) NOT NULL,
  description VARCHAR(250) NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL,
  PRIMARY KEY(user_id,id),
  INDEX idx_expense_date (user_id, transaction_date),
  CONSTRAINT fk_expense_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_expense_category FOREIGN KEY (user_id, category)
    REFERENCES categories(user_id,name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incomes (
  user_id BIGINT UNSIGNED NOT NULL,
  id BIGINT UNSIGNED NOT NULL,
  transaction_date DATE NOT NULL,
  source VARCHAR(150) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  PRIMARY KEY(user_id,id),
  INDEX idx_income_date (user_id, transaction_date),
  CONSTRAINT fk_income_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS monthly_budgets (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  CONSTRAINT fk_budget_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS category_budgets (
  user_id BIGINT UNSIGNED NOT NULL,
  category VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY(user_id,category),
  CONSTRAINT fk_category_budget FOREIGN KEY (user_id, category)
    REFERENCES categories(user_id,name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saving_goals (
  user_id BIGINT UNSIGNED NOT NULL,
  id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(100) NOT NULL,
  target DECIMAL(12,2) NOT NULL,
  saved DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  due_date DATE NOT NULL,
  PRIMARY KEY(user_id,id),
  CONSTRAINT fk_goal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance_preferences (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  dark_mode TINYINT(1) NOT NULL DEFAULT 0,
  budget_alerts TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_preference_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
