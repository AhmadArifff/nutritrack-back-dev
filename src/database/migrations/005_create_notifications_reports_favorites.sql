CREATE TABLE IF NOT EXISTS push_subscriptions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_push_endpoint (endpoint(255)),
  CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS weekly_reports (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  avg_calories DECIMAL(8,2),
  avg_protein_g DECIMAL(8,2),
  avg_carbs_g DECIMAL(8,2),
  avg_fat_g DECIMAL(8,2),
  avg_water_ml DECIMAL(8,2),
  weight_start_kg DECIMAL(5,2),
  weight_end_kg DECIMAL(5,2),
  weight_change_kg DECIMAL(5,2),
  total_days_logged INT DEFAULT 0,
  consistency_score INT,
  nutrition_score INT,
  overall_score INT,
  summary_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_weekly_reports_user_week (user_id, week_start_date),
  CONSTRAINT fk_weekly_reports_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS favorite_foods (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  food_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_favorite_foods_unique (user_id, food_id),
  CONSTRAINT fk_favorite_foods_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_favorite_foods_food FOREIGN KEY (food_id) REFERENCES food_database(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(140) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('meal_reminder', 'hydration', 'achievement', 'weekly_report', 'system') DEFAULT 'system',
  status ENUM('unread', 'read', 'archived') DEFAULT 'unread',
  scheduled_at DATETIME NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user_status (user_id, status),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id CHAR(36) PRIMARY KEY,
  theme ENUM('light', 'dark', 'system') DEFAULT 'light',
  locale VARCHAR(12) DEFAULT 'id-ID',
  timezone VARCHAR(80) DEFAULT 'Asia/Jakarta',
  notification_enabled BOOLEAN DEFAULT TRUE,
  meal_reminder_enabled BOOLEAN DEFAULT TRUE,
  water_reminder_enabled BOOLEAN DEFAULT TRUE,
  weekly_report_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
