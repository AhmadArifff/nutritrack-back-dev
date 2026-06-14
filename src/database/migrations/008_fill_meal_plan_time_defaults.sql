UPDATE meal_plans
SET planned_time = CASE meal_type
  WHEN 'breakfast' THEN '07:30:00'
  WHEN 'morning_snack' THEN '10:00:00'
  WHEN 'lunch' THEN '12:30:00'
  WHEN 'afternoon_snack' THEN '15:30:00'
  WHEN 'dinner' THEN '19:00:00'
  WHEN 'late_snack' THEN '21:00:00'
  ELSE '12:00:00'
END
WHERE planned_time IS NULL;
