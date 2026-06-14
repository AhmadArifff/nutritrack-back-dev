const express = require("express");
const { query } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.get(
  "/summary",
  authenticate,
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));

    const [profileRows, summaryRows, scheduleRows, weightRows, notificationRows] = await Promise.all([
      query("SELECT * FROM profiles WHERE id = :userId", { userId: req.user.id }),
      query(
        `SELECT
           COALESCE(SUM(calories), 0) AS calories,
           COALESCE(SUM(protein_g), 0) AS proteinG,
           COALESCE(SUM(carbohydrates_g), 0) AS carbohydratesG,
           COALESCE(SUM(fat_g), 0) AS fatG,
           COALESCE(SUM(fiber_g), 0) AS fiberG,
           COUNT(*) AS mealsLogged
         FROM food_logs
         WHERE user_id = :userId AND log_date = :date`,
        { userId: req.user.id, date }
      ),
      query(
        `SELECT
           mp.id,
           mp.meal_type AS mealType,
           mp.planned_time AS scheduledTime,
           TRUE AS reminderEnabled,
           CASE WHEN mp.is_completed THEN 1 ELSE 0 END AS loggedItems,
           COALESCE(mp.target_calories, fd.calories * mp.serving_amount, 0) AS calories,
           mp.food_name AS foodName,
           mp.is_completed AS isCompleted
         FROM meal_plans mp
         LEFT JOIN food_database fd ON fd.id = mp.food_id
         WHERE mp.user_id = :userId AND mp.plan_date = :date
         ORDER BY mp.planned_time,
           FIELD(mp.meal_type, 'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'late_snack'),
           mp.created_at`,
        { userId: req.user.id, date }
      ),
      query(
        `SELECT weight_kg AS weightKg, bmi, bmi_category AS bmiCategory, log_date AS logDate
         FROM weight_logs
         WHERE user_id = :userId
         ORDER BY log_date DESC
         LIMIT 1`,
        { userId: req.user.id }
      ),
      query(
        `SELECT COUNT(*) AS unread
         FROM notifications
         WHERE user_id = :userId AND status = 'unread'`,
        { userId: req.user.id }
      )
    ]);

    const profile = profileRows[0] || {};
    const summary = summaryRows[0] || {};
    const targetCalories = Number(profile.target_calories || 0);
    const calories = Number(summary.calories || 0);

    res.json({
      date,
      user: {
        id: req.user.id,
        fullName: req.user.full_name,
        avatarUrl: req.user.avatar_url
      },
      calories: {
        consumed: calories,
        target: targetCalories,
        remaining: Math.max(targetCalories - calories, 0),
        progress: targetCalories ? Math.round((calories / targetCalories) * 100) : 0
      },
      macros: {
        protein: { consumed: Number(summary.proteinG || 0), target: Number(profile.target_protein_g || 0) },
        carbs: { consumed: Number(summary.carbohydratesG || 0), target: Number(profile.target_carbs_g || 0) },
        fat: { consumed: Number(summary.fatG || 0), target: Number(profile.target_fat_g || 0) },
        fiber: { consumed: Number(summary.fiberG || 0), target: Number(profile.target_fiber_g || 0) }
      },
      schedule: scheduleRows,
      weight: weightRows[0] || null,
      unreadNotifications: notificationRows[0]?.unread || 0
    });
  })
);

module.exports = router;
