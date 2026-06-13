CREATE TABLE IF NOT EXISTS daily_nutrition_summaries (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  summary_date DATE NOT NULL,
  total_calories DECIMAL(8,2) DEFAULT 0,
  total_protein_g DECIMAL(8,2) DEFAULT 0,
  total_carbohydrates_g DECIMAL(8,2) DEFAULT 0,
  total_fat_g DECIMAL(8,2) DEFAULT 0,
  total_fiber_g DECIMAL(8,2) DEFAULT 0,
  total_sugar_g DECIMAL(8,2) DEFAULT 0,
  total_sodium_mg DECIMAL(8,2) DEFAULT 0,
  water_intake_ml INT DEFAULT 0,
  meals_logged INT DEFAULT 0,
  target_calories DECIMAL(8,2),
  calorie_difference DECIMAL(8,2),
  nutrition_score INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_daily_summaries_user_date (user_id, summary_date),
  CONSTRAINT fk_daily_summaries_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS water_logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  amount_ml INT NOT NULL DEFAULT 250,
  log_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  log_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_water_logs_user_date (user_id, log_date),
  CONSTRAINT fk_water_logs_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS achievements (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  category ENUM('consistency', 'weight', 'nutrition', 'hydration', 'milestone'),
  points INT DEFAULT 10,
  condition_type VARCHAR(50),
  condition_value DECIMAL(10,2),
  badge_image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_achievements (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  achievement_id CHAR(36) NOT NULL,
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_user_achievement_unique (user_id, achievement_id),
  CONSTRAINT fk_user_achievements_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_achievements_achievement FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
