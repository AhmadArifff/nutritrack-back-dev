const express = require("express");
const { z } = require("zod");
const { query } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

const profileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  heightCm: z.coerce.number().positive().optional().nullable(),
  currentWeightKg: z.coerce.number().positive().optional().nullable(),
  targetWeightKg: z.coerce.number().positive().optional().nullable(),
  activityLevel: z.enum(["sedentary", "lightly_active", "moderately_active", "very_active", "extremely_active"]).optional(),
  goalType: z.enum(["lose_weight", "gain_weight", "maintain_weight", "eat_healthy"]).optional(),
  targetCalories: z.coerce.number().positive().optional().nullable(),
  targetProteinG: z.coerce.number().nonnegative().optional().nullable(),
  targetCarbsG: z.coerce.number().nonnegative().optional().nullable(),
  targetFatG: z.coerce.number().nonnegative().optional().nullable(),
  targetFiberG: z.coerce.number().nonnegative().optional().nullable(),
  targetWaterMl: z.coerce.number().positive().optional().nullable(),
  dietType: z.string().max(20).optional(),
  allergies: z.array(z.string()).optional(),
  cuisinePreferences: z.array(z.string()).optional(),
  weeklyWeightGoalKg: z.coerce.number().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  onboardingCompleted: z.boolean().optional()
});

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const rows = await query("SELECT * FROM profiles WHERE id = :userId", { userId: req.user.id });
    res.json(rows[0]);
  })
);

router.put(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = profileSchema.parse(req.body);

    await query(
      `UPDATE profiles SET
        full_name = COALESCE(:fullName, full_name),
        avatar_url = COALESCE(:avatarUrl, avatar_url),
        date_of_birth = COALESCE(:dateOfBirth, date_of_birth),
        gender = COALESCE(:gender, gender),
        height_cm = COALESCE(:heightCm, height_cm),
        current_weight_kg = COALESCE(:currentWeightKg, current_weight_kg),
        target_weight_kg = COALESCE(:targetWeightKg, target_weight_kg),
        activity_level = COALESCE(:activityLevel, activity_level),
        goal_type = COALESCE(:goalType, goal_type),
        target_calories = COALESCE(:targetCalories, target_calories),
        target_protein_g = COALESCE(:targetProteinG, target_protein_g),
        target_carbs_g = COALESCE(:targetCarbsG, target_carbs_g),
        target_fat_g = COALESCE(:targetFatG, target_fat_g),
        target_fiber_g = COALESCE(:targetFiberG, target_fiber_g),
        target_water_ml = COALESCE(:targetWaterMl, target_water_ml),
        diet_type = COALESCE(:dietType, diet_type),
        allergies = COALESCE(:allergies, allergies),
        cuisine_preferences = COALESCE(:cuisinePreferences, cuisine_preferences),
        weekly_weight_goal_kg = COALESCE(:weeklyWeightGoalKg, weekly_weight_goal_kg),
        target_date = COALESCE(:targetDate, target_date),
        onboarding_completed = COALESCE(:onboardingCompleted, onboarding_completed)
       WHERE id = :userId`,
      {
        userId: req.user.id,
        fullName: payload.fullName ?? null,
        avatarUrl: payload.avatarUrl ?? null,
        dateOfBirth: payload.dateOfBirth ?? null,
        gender: payload.gender ?? null,
        heightCm: payload.heightCm ?? null,
        currentWeightKg: payload.currentWeightKg ?? null,
        targetWeightKg: payload.targetWeightKg ?? null,
        activityLevel: payload.activityLevel ?? null,
        goalType: payload.goalType ?? null,
        targetCalories: payload.targetCalories ?? null,
        targetProteinG: payload.targetProteinG ?? null,
        targetCarbsG: payload.targetCarbsG ?? null,
        targetFatG: payload.targetFatG ?? null,
        targetFiberG: payload.targetFiberG ?? null,
        targetWaterMl: payload.targetWaterMl ?? null,
        dietType: payload.dietType ?? null,
        allergies: payload.allergies ? JSON.stringify(payload.allergies) : null,
        cuisinePreferences: payload.cuisinePreferences ? JSON.stringify(payload.cuisinePreferences) : null,
        weeklyWeightGoalKg: payload.weeklyWeightGoalKg ?? null,
        targetDate: payload.targetDate ?? null,
        onboardingCompleted: payload.onboardingCompleted ?? null
      }
    );

    if (payload.fullName) {
      await query("UPDATE users SET full_name = :fullName WHERE id = :userId", {
        fullName: payload.fullName,
        userId: req.user.id
      });
    }

    const rows = await query("SELECT * FROM profiles WHERE id = :userId", { userId: req.user.id });
    res.json(rows[0]);
  })
);

module.exports = router;
