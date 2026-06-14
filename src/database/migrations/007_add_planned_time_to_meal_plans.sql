ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS planned_time TIME NULL AFTER meal_type;
