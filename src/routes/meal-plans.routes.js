const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { query } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

const mealPlanSchema = z.object({
  planName: z.string().max(100).optional(),
  planDate: z.string(),
  mealType: z.enum(["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "late_snack"]),
  foodId: z.string().uuid().optional(),
  foodName: z.string().min(1).max(200),
  servingAmount: z.coerce.number().positive().default(1),
  servingUnit: z.string().max(50).default("porsi"),
  targetCalories: z.coerce.number().nonnegative().optional(),
  targetProteinG: z.coerce.number().nonnegative().optional(),
  targetCarbsG: z.coerce.number().nonnegative().optional(),
  targetFatG: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional()
});

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const from = String(req.query.from || new Date().toISOString().slice(0, 10));
    const to = String(req.query.to || from);

    const rows = await query(
      `SELECT *
       FROM meal_plans
       WHERE user_id = :userId AND plan_date BETWEEN :from AND :to
       ORDER BY plan_date,
         FIELD(meal_type, 'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'late_snack'),
         created_at`,
      { userId: req.user.id, from, to }
    );

    res.json(rows);
  })
);

router.post(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = mealPlanSchema.parse(req.body);
    const id = randomUUID();

    await query(
      `INSERT INTO meal_plans
       (id, user_id, plan_name, plan_date, meal_type, food_id, food_name, serving_amount, serving_unit,
        target_calories, target_protein_g, target_carbs_g, target_fat_g, notes)
       VALUES
       (:id, :userId, :planName, :planDate, :mealType, :foodId, :foodName, :servingAmount, :servingUnit,
        :targetCalories, :targetProteinG, :targetCarbsG, :targetFatG, :notes)`,
      {
        id,
        userId: req.user.id,
        planName: payload.planName || null,
        planDate: payload.planDate,
        mealType: payload.mealType,
        foodId: payload.foodId || null,
        foodName: payload.foodName,
        servingAmount: payload.servingAmount,
        servingUnit: payload.servingUnit,
        targetCalories: payload.targetCalories || null,
        targetProteinG: payload.targetProteinG || null,
        targetCarbsG: payload.targetCarbsG || null,
        targetFatG: payload.targetFatG || null,
        notes: payload.notes || null
      }
    );

    res.status(201).json({ id, message: "Meal plan berhasil ditambahkan." });
  })
);

router.patch(
  "/:id/complete",
  authenticate,
  asyncHandler(async (req, res) => {
    await query(
      `UPDATE meal_plans
       SET is_completed = TRUE, completed_at = NOW()
       WHERE id = :id AND user_id = :userId`,
      { id: req.params.id, userId: req.user.id }
    );

    res.json({ message: "Meal plan ditandai selesai." });
  })
);

module.exports = router;
