ALTER TABLE food_logs
  ADD COLUMN meal_plan_id CHAR(36) NULL AFTER food_id,
  ADD UNIQUE KEY idx_food_logs_meal_plan_user (user_id, meal_plan_id),
  ADD CONSTRAINT fk_food_logs_meal_plan
    FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id)
    ON DELETE SET NULL;

ALTER TABLE notifications
  ADD COLUMN entity_type VARCHAR(60) NULL AFTER type,
  ADD COLUMN entity_id CHAR(36) NULL AFTER entity_type,
  ADD INDEX idx_notifications_entity (user_id, entity_type, entity_id, scheduled_at);
