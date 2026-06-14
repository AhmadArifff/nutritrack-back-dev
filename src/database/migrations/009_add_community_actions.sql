ALTER TABLE profiles
  ADD COLUMN username VARCHAR(80) NULL UNIQUE AFTER full_name,
  ADD COLUMN bio TEXT NULL AFTER avatar_url,
  ADD COLUMN location VARCHAR(140) NULL AFTER bio,
  ADD COLUMN diet_focus VARCHAR(80) NULL AFTER diet_type,
  ADD COLUMN is_pro BOOLEAN DEFAULT FALSE AFTER diet_focus;

ALTER TABLE community_challenges
  ADD COLUMN slug VARCHAR(180) NULL UNIQUE AFTER title,
  ADD COLUMN icon_name VARCHAR(80) NULL AFTER image_url,
  ADD COLUMN badge_label VARCHAR(40) NULL AFTER icon_name,
  ADD COLUMN badge_variant ENUM('hot', 'high_impact', 'new', 'premium') DEFAULT 'new' AFTER badge_label,
  ADD COLUMN category VARCHAR(80) NULL AFTER badge_variant,
  ADD COLUMN difficulty ENUM('easy', 'medium', 'hard') DEFAULT 'medium' AFTER category,
  ADD COLUMN duration_days INT DEFAULT 7 AFTER difficulty,
  ADD COLUMN start_date DATE NULL AFTER duration_days,
  ADD COLUMN end_date DATE NULL AFTER start_date,
  ADD COLUMN is_premium BOOLEAN DEFAULT FALSE AFTER is_active,
  ADD COLUMN created_by CHAR(36) NULL AFTER is_premium,
  ADD CONSTRAINT fk_community_challenges_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE community_posts
  ADD COLUMN user_id CHAR(36) NULL AFTER id,
  ADD COLUMN post_type ENUM('win', 'story', 'meal_prep', 'challenge_update', 'progress') DEFAULT 'story' AFTER image_url,
  ADD COLUMN achievement_label VARCHAR(100) NULL AFTER post_type,
  ADD COLUMN related_challenge_id CHAR(36) NULL AFTER achievement_label,
  ADD COLUMN visibility ENUM('public', 'buddies', 'private') DEFAULT 'public' AFTER related_challenge_id,
  ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE AFTER visibility,
  ADD COLUMN shares_count INT DEFAULT 0 AFTER comments_count,
  ADD COLUMN deleted_at TIMESTAMP NULL AFTER updated_at,
  ADD CONSTRAINT fk_community_posts_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT fk_community_posts_challenge
    FOREIGN KEY (related_challenge_id) REFERENCES community_challenges(id)
    ON DELETE SET NULL;

UPDATE community_challenges
SET
  slug = LOWER(REPLACE(REPLACE(title, ' ', '-'), '/', '-')),
  badge_label = COALESCE(badge, badge_label),
  badge_variant = CASE
    WHEN badge_tone = 'purple' THEN 'high_impact'
    WHEN LOWER(COALESCE(badge, '')) = 'hot' THEN 'hot'
    ELSE COALESCE(badge_variant, 'new')
  END
WHERE slug IS NULL;

UPDATE community_posts
SET
  achievement_label = COALESCE(author_badge, achievement_label),
  user_id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
WHERE user_id IS NULL;

CREATE TABLE IF NOT EXISTS community_challenge_members (
  id CHAR(36) PRIMARY KEY,
  challenge_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  status ENUM('joined', 'completed', 'left') DEFAULT 'joined',
  progress_day INT DEFAULT 0,
  completed_at TIMESTAMP NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_challenge_member_unique (challenge_id, user_id),
  INDEX idx_challenge_member_user (user_id),
  CONSTRAINT fk_challenge_members_challenge
    FOREIGN KEY (challenge_id) REFERENCES community_challenges(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_challenge_members_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_buddy_connections (
  id CHAR(36) PRIMARY KEY,
  buddy_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  status ENUM('requested', 'connected') DEFAULT 'requested',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_buddy_connection_unique (buddy_id, user_id),
  INDEX idx_buddy_connection_user (user_id),
  CONSTRAINT fk_buddy_connections_buddy
    FOREIGN KEY (buddy_id) REFERENCES community_buddies(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_buddy_connections_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_post_cheers (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_post_cheer_unique (post_id, user_id),
  INDEX idx_post_cheer_user (user_id),
  CONSTRAINT fk_post_cheers_post
    FOREIGN KEY (post_id) REFERENCES community_posts(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_post_cheers_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_post_comments (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  author_avatar_url TEXT,
  body TEXT NOT NULL,
  parent_comment_id CHAR(36) NULL,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_post_comments_post (post_id, created_at),
  CONSTRAINT fk_post_comments_post
    FOREIGN KEY (post_id) REFERENCES community_posts(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_post_comments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id CHAR(36) PRIMARY KEY,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_logged_date DATE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_streaks_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO user_streaks (user_id, current_streak, longest_streak, last_logged_date)
SELECT id, streak_days, streak_days, last_log_date
FROM profiles;
