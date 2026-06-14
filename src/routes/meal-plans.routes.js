const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { query } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const HttpError = require("../utils/http-error");

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

router.get(
  "/shopping-list",
  authenticate,
  asyncHandler(async (req, res) => {
    const from = String(req.query.from || new Date().toISOString().slice(0, 10));
    const to = String(req.query.to || from);
    const rows = await query(
      `SELECT
         COALESCE(fd.sub_category, 'Groceries') AS groupName,
         mp.food_name AS name,
         SUM(mp.serving_amount) AS amount,
         COALESCE(mp.serving_unit, fd.serving_unit, 'porsi') AS unit,
         COUNT(*) AS meals
       FROM meal_plans mp
       LEFT JOIN food_database fd ON fd.id = mp.food_id
       WHERE mp.user_id = :userId AND mp.plan_date BETWEEN :from AND :to
       GROUP BY groupName, mp.food_name, unit
       ORDER BY groupName, name`,
      { userId: req.user.id, from, to }
    );

    const grouped = rows.reduce((acc, row) => {
      const group = row.groupName || "Groceries";
      if (!acc[group]) acc[group] = [];
      acc[group].push({
        name: row.name,
        amount: `${Number(row.amount || 0).toLocaleString("en-US", { maximumFractionDigits: 1 })} ${row.unit}`,
        meals: `${row.meals} meal${Number(row.meals) > 1 ? "s" : ""}`
      });
      return acc;
    }, {});

    res.json(Object.entries(grouped).map(([group, items]) => ({ group, items })));
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

router.put(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = mealPlanSchema.partial().parse(req.body);
    const result = await query(
      `UPDATE meal_plans SET
        plan_name = COALESCE(:planName, plan_name),
        plan_date = COALESCE(:planDate, plan_date),
        meal_type = COALESCE(:mealType, meal_type),
        food_id = COALESCE(:foodId, food_id),
        food_name = COALESCE(:foodName, food_name),
        serving_amount = COALESCE(:servingAmount, serving_amount),
        serving_unit = COALESCE(:servingUnit, serving_unit),
        target_calories = COALESCE(:targetCalories, target_calories),
        target_protein_g = COALESCE(:targetProteinG, target_protein_g),
        target_carbs_g = COALESCE(:targetCarbsG, target_carbs_g),
        target_fat_g = COALESCE(:targetFatG, target_fat_g),
        notes = COALESCE(:notes, notes)
       WHERE id = :id AND user_id = :userId`,
      {
        id: req.params.id,
        userId: req.user.id,
        planName: payload.planName ?? null,
        planDate: payload.planDate ?? null,
        mealType: payload.mealType ?? null,
        foodId: payload.foodId ?? null,
        foodName: payload.foodName ?? null,
        servingAmount: payload.servingAmount ?? null,
        servingUnit: payload.servingUnit ?? null,
        targetCalories: payload.targetCalories ?? null,
        targetProteinG: payload.targetProteinG ?? null,
        targetCarbsG: payload.targetCarbsG ?? null,
        targetFatG: payload.targetFatG ?? null,
        notes: payload.notes ?? null
      }
    );
    if (!result.affectedRows) throw new HttpError(404, "Meal plan tidak ditemukan.");
    res.json({ message: "Meal plan berhasil diperbarui." });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await query("DELETE FROM meal_plans WHERE id = :id AND user_id = :userId", {
      id: req.params.id,
      userId: req.user.id
    });
    if (!result.affectedRows) throw new HttpError(404, "Meal plan tidak ditemukan.");
    res.json({ message: "Meal plan berhasil dihapus." });
  })
);

module.exports = router;
