const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { query, transaction } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const HttpError = require("../utils/http-error");

const router = express.Router();

const foodLogSchema = z.object({
  foodId: z.string().uuid().optional(),
  foodName: z.string().min(1).max(200).optional(),
  mealType: z.enum(["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "late_snack"]),
  logDate: z.string().optional(),
  servingAmount: z.coerce.number().positive().default(1),
  servingUnit: z.string().max(50).default("porsi"),
  servingSizeG: z.coerce.number().positive().optional(),
  calories: z.coerce.number().nonnegative().optional(),
  proteinG: z.coerce.number().nonnegative().default(0),
  carbohydratesG: z.coerce.number().nonnegative().default(0),
  fatG: z.coerce.number().nonnegative().default(0),
  fiberG: z.coerce.number().nonnegative().default(0),
  sugarG: z.coerce.number().nonnegative().default(0),
  sodiumMg: z.coerce.number().nonnegative().default(0),
  notes: z.string().optional()
});

function scaleNutrition(food, servingAmount) {
  return {
    calories: Number(food.calories || 0) * servingAmount,
    proteinG: Number(food.protein_g || 0) * servingAmount,
    carbohydratesG: Number(food.carbohydrates_g || 0) * servingAmount,
    fatG: Number(food.fat_g || 0) * servingAmount,
    fiberG: Number(food.fiber_g || 0) * servingAmount,
    sugarG: Number(food.sugar_g || 0) * servingAmount,
    sodiumMg: Number(food.sodium_mg || 0) * servingAmount
  };
}

async function refreshDailySummary(connection, userId, date) {
  const [nutritionRows] = await connection.execute(
    `SELECT
       COALESCE(SUM(calories), 0) AS total_calories,
       COALESCE(SUM(protein_g), 0) AS total_protein_g,
       COALESCE(SUM(carbohydrates_g), 0) AS total_carbohydrates_g,
       COALESCE(SUM(fat_g), 0) AS total_fat_g,
       COALESCE(SUM(fiber_g), 0) AS total_fiber_g,
       COALESCE(SUM(sugar_g), 0) AS total_sugar_g,
       COALESCE(SUM(sodium_mg), 0) AS total_sodium_mg,
       COUNT(*) AS meals_logged
     FROM food_logs
     WHERE user_id = ? AND log_date = ?`,
    [userId, date]
  );

  const [waterRows] = await connection.execute(
    `SELECT COALESCE(SUM(amount_ml), 0) AS water_intake_ml
     FROM water_logs
     WHERE user_id = ? AND log_date = ?`,
    [userId, date]
  );

  const [profileRows] = await connection.execute("SELECT target_calories FROM profiles WHERE id = ?", [userId]);
  const nutrition = nutritionRows[0];
  const water = waterRows[0];
  const targetCalories = profileRows[0]?.target_calories || 0;
  const score = targetCalories
    ? Math.max(0, Math.min(100, Math.round((Number(nutrition.total_calories) / Number(targetCalories)) * 100)))
    : 0;

  await connection.execute(
    `INSERT INTO daily_nutrition_summaries
     (id, user_id, summary_date, total_calories, total_protein_g, total_carbohydrates_g, total_fat_g,
      total_fiber_g, total_sugar_g, total_sodium_mg, water_intake_ml, meals_logged, target_calories,
      calorie_difference, nutrition_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_calories = VALUES(total_calories),
       total_protein_g = VALUES(total_protein_g),
       total_carbohydrates_g = VALUES(total_carbohydrates_g),
       total_fat_g = VALUES(total_fat_g),
       total_fiber_g = VALUES(total_fiber_g),
       total_sugar_g = VALUES(total_sugar_g),
       total_sodium_mg = VALUES(total_sodium_mg),
       water_intake_ml = VALUES(water_intake_ml),
       meals_logged = VALUES(meals_logged),
       target_calories = VALUES(target_calories),
       calorie_difference = VALUES(calorie_difference),
       nutrition_score = VALUES(nutrition_score)`,
    [
      randomUUID(),
      userId,
      date,
      nutrition.total_calories,
      nutrition.total_protein_g,
      nutrition.total_carbohydrates_g,
      nutrition.total_fat_g,
      nutrition.total_fiber_g,
      nutrition.total_sugar_g,
      nutrition.total_sodium_mg,
      water.water_intake_ml,
      nutrition.meals_logged,
      targetCalories,
      Number(nutrition.total_calories) - Number(targetCalories || 0),
      score
    ]
  );
}

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const rows = await query(
      `SELECT *
       FROM food_logs
       WHERE user_id = :userId AND log_date = :date
       ORDER BY FIELD(meal_type, 'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'late_snack'), created_at`,
      { userId: req.user.id, date }
    );

    res.json(rows);
  })
);

router.post(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = foodLogSchema.parse(req.body);
    const id = randomUUID();
    const date = payload.logDate || new Date().toISOString().slice(0, 10);
    let nutrition = {
      calories: payload.calories,
      proteinG: payload.proteinG,
      carbohydratesG: payload.carbohydratesG,
      fatG: payload.fatG,
      fiberG: payload.fiberG,
      sugarG: payload.sugarG,
      sodiumMg: payload.sodiumMg
    };
    let foodName = payload.foodName;
    let servingSizeG = payload.servingSizeG;

    if (payload.foodId) {
      const foods = await query("SELECT * FROM food_database WHERE id = :id", { id: payload.foodId });
      if (!foods.length) {
        throw new HttpError(404, "Makanan tidak ditemukan.");
      }
      const food = foods[0];
      foodName = foodName || food.name;
      servingSizeG = servingSizeG || food.serving_size_g;
      nutrition = scaleNutrition(food, payload.servingAmount);
    }

    if (!foodName || nutrition.calories === undefined) {
      throw new HttpError(422, "foodName dan calories wajib diisi untuk input manual.");
    }

    await transaction(async (connection) => {
      await connection.execute(
        `INSERT INTO food_logs
         (id, user_id, food_id, food_name, meal_type, log_date, serving_amount, serving_unit, serving_size_g,
          calories, protein_g, carbohydrates_g, fat_g, fiber_g, sugar_g, sodium_mg, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          req.user.id,
          payload.foodId || null,
          foodName,
          payload.mealType,
          date,
          payload.servingAmount,
          payload.servingUnit,
          servingSizeG || null,
          nutrition.calories,
          nutrition.proteinG,
          nutrition.carbohydratesG,
          nutrition.fatG,
          nutrition.fiberG,
          nutrition.sugarG,
          nutrition.sodiumMg,
          payload.notes || null
        ]
      );
      await refreshDailySummary(connection, req.user.id, date);
    });

    res.status(201).json({ id, message: "Log makanan berhasil ditambahkan." });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const rows = await query("SELECT log_date FROM food_logs WHERE id = :id AND user_id = :userId", {
      id: req.params.id,
      userId: req.user.id
    });

    if (!rows.length) {
      throw new HttpError(404, "Log makanan tidak ditemukan.");
    }

    await transaction(async (connection) => {
      await connection.execute("DELETE FROM food_logs WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
      await refreshDailySummary(connection, req.user.id, rows[0].log_date);
    });

    res.json({ message: "Log makanan berhasil dihapus." });
  })
);

module.exports = router;
