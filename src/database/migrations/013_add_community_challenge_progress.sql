ALTER TABLE community_challenges
  ADD COLUMN reward_points INT DEFAULT 100 AFTER is_premium,
  ADD COLUMN reward_badge VARCHAR(120) NULL AFTER reward_points,
  ADD COLUMN reward_achievement_code VARCHAR(50) NULL AFTER reward_badge;

CREATE TABLE IF NOT EXISTS community_challenge_tasks (
  id CHAR(36) PRIMARY KEY,
  challenge_id CHAR(36) NOT NULL,
  day_number INT DEFAULT 1,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  task_type ENUM('food_log', 'water_intake', 'weight_log', 'challenge_post', 'manual') DEFAULT 'manual',
  target_value DECIMAL(10,2) DEFAULT 1,
  target_unit VARCHAR(40) DEFAULT 'check',
  points INT DEFAULT 10,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_challenge_task_unique (challenge_id, day_number, title),
  INDEX idx_challenge_tasks_challenge_day (challenge_id, day_number, sort_order),
  CONSTRAINT fk_challenge_tasks_challenge
    FOREIGN KEY (challenge_id) REFERENCES community_challenges(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_challenge_checkins (
  id CHAR(36) PRIMARY KEY,
  challenge_id CHAR(36) NOT NULL,
  task_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  checkin_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  source_type ENUM('manual', 'food_log', 'water_intake', 'weight_log', 'challenge_post') DEFAULT 'manual',
  status ENUM('pending', 'completed') DEFAULT 'completed',
  value DECIMAL(10,2) DEFAULT 1,
  note TEXT,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_challenge_checkin_unique (task_id, user_id, checkin_date),
  INDEX idx_challenge_checkins_user (user_id, challenge_id, status),
  CONSTRAINT fk_challenge_checkins_challenge
    FOREIGN KEY (challenge_id) REFERENCES community_challenges(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_challenge_checkins_task
    FOREIGN KEY (task_id) REFERENCES community_challenge_tasks(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_challenge_checkins_user
    FOREIGN KEY (user_id) REFERENCES profiles(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO achievements
  (id, code, name, description, icon, category, points, condition_type, condition_value)
VALUES
  (UUID(), 'CHALLENGE_FINISHER', 'Challenge Finisher', 'Selesaikan satu health challenge komunitas.', 'trophy', 'milestone', 100, 'challenge_completed', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  icon = VALUES(icon),
  category = VALUES(category),
  points = VALUES(points),
  condition_type = VALUES(condition_type),
  condition_value = VALUES(condition_value);

UPDATE community_challenges
SET
  reward_points = COALESCE(reward_points, 100),
  reward_badge = COALESCE(reward_badge, CONCAT(title, ' Badge')),
  reward_achievement_code = COALESCE(reward_achievement_code, 'CHALLENGE_FINISHER');

INSERT IGNORE INTO community_challenge_tasks
  (id, challenge_id, day_number, title, description, task_type, target_value, target_unit, points, sort_order)
SELECT UUID(), id, 1, 'Log one balanced meal', 'Catat minimal satu makanan yang mendukung challenge hari ini.', 'food_log', 1, 'meal', 15, 1
FROM community_challenges
WHERE title LIKE '%Meal Prep%' OR title LIKE '%Mediterranean%';

INSERT IGNORE INTO community_challenge_tasks
  (id, challenge_id, day_number, title, description, task_type, target_value, target_unit, points, sort_order)
SELECT UUID(), id, 1, 'Plan a colorful lunch', 'Siapkan atau rencanakan lunch dengan protein, fiber, dan healthy fat.', 'manual', 1, 'check', 15, 2
FROM community_challenges
WHERE title LIKE '%Meal Prep%' OR title LIKE '%Mediterranean%';

INSERT IGNORE INTO community_challenge_tasks
  (id, challenge_id, day_number, title, description, task_type, target_value, target_unit, points, sort_order)
SELECT UUID(), id, 2, 'Share a meal prep update', 'Bagikan update challenge agar buddy komunitas bisa memberi cheers.', 'challenge_post', 1, 'post', 20, 3
FROM community_challenges
WHERE title LIKE '%Meal Prep%' OR title LIKE '%Mediterranean%';

INSERT IGNORE INTO community_challenge_tasks
  (id, challenge_id, day_number, title, description, task_type, target_value, target_unit, points, sort_order)
SELECT UUID(), id, 1, 'Drink 1.5L water', 'Catat asupan air minimal 1.500 ml hari ini.', 'water_intake', 1500, 'ml', 15, 1
FROM community_challenges
WHERE title LIKE '%Hydration%';

INSERT IGNORE INTO community_challenge_tasks
  (id, challenge_id, day_number, title, description, task_type, target_value, target_unit, points, sort_order)
SELECT UUID(), id, 1, 'Hydration reflection', 'Check-in singkat: energi, fokus, dan rasa lapar setelah hidrasi cukup.', 'manual', 1, 'check', 10, 2
FROM community_challenges
WHERE title LIKE '%Hydration%';

INSERT IGNORE INTO community_challenge_tasks
  (id, challenge_id, day_number, title, description, task_type, target_value, target_unit, points, sort_order)
SELECT UUID(), id, 2, 'Share hydration win', 'Posting update challenge setelah target hidrasi tercapai.', 'challenge_post', 1, 'post', 20, 3
FROM community_challenges
WHERE title LIKE '%Hydration%';

INSERT IGNORE INTO community_challenge_tasks
  (id, challenge_id, day_number, title, description, task_type, target_value, target_unit, points, sort_order)
SELECT UUID(), c.id, 1, 'First challenge check-in', 'Selesaikan check-in pertama untuk membuka progress challenge.', 'manual', 1, 'check', 10, 1
FROM community_challenges c
WHERE NOT EXISTS (
  SELECT 1 FROM community_challenge_tasks t WHERE t.challenge_id = c.id
);
