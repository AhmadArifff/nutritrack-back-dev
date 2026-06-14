const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { query, transaction } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

const waterSchema = z.object({
  amountMl: z.coerce.number().int().positive().default(250),
  logDate: z.string().optional()
});

router.get(
  "/summary",
  authenticate,
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const [profileRows, nutritionRows, waterRows] = await Promise.all([
      query("SELECT target_calories, target_protein_g, target_carbs_g, target_fat_g, target_fiber_g, target_water_ml FROM profiles WHERE id = :userId", { userId: req.user.id }),
      query(
        `SELECT
          COALESCE(SUM(calories), 0) AS calories,
          COALESCE(SUM(protein_g), 0) AS proteinG,
          COALESCE(SUM(carbohydrates_g), 0) AS carbsG,
          COALESCE(SUM(fat_g), 0) AS fatG,
          COALESCE(SUM(fiber_g), 0) AS fiberG,
          COALESCE(SUM(sugar_g), 0) AS sugarG,
          COALESCE(SUM(sodium_mg), 0) AS sodiumMg
         FROM food_logs
         WHERE user_id = :userId AND log_date = :date`,
        { userId: req.user.id, date }
      ),
      query(
        `SELECT COALESCE(SUM(amount_ml), 0) AS waterMl
         FROM water_logs
         WHERE user_id = :userId AND log_date = :date`,
        { userId: req.user.id, date }
      )
    ]);

    const profile = profileRows[0] || {};
    const nutrition = nutritionRows[0] || {};
    const waterMl = Number(waterRows[0]?.waterMl || 0);

    res.json({
      date,
      calories: {
        consumed: Number(nutrition.calories || 0),
        target: Number(profile.target_calories || 0)
      },
      macros: {
        protein: { consumed: Number(nutrition.proteinG || 0), target: Number(profile.target_protein_g || 0), unit: "g" },
        carbs: { consumed: Number(nutrition.carbsG || 0), target: Number(profile.target_carbs_g || 0), unit: "g" },
        fats: { consumed: Number(nutrition.fatG || 0), target: Number(profile.target_fat_g || 0), unit: "g" },
        fiber: { consumed: Number(nutrition.fiberG || 0), target: Number(profile.target_fiber_g || 0), unit: "g" }
      },
      micronutrients: {
        sugarG: Number(nutrition.sugarG || 0),
        sodiumMg: Number(nutrition.sodiumMg || 0)
      },
      hydration: {
        waterMl,
        targetWaterMl: Number(profile.target_water_ml || 2000),
        cups: Math.round(waterMl / 250)
      }
    });
  })
);

router.post(
  "/water",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = waterSchema.parse(req.body);
    const logDate = payload.logDate || new Date().toISOString().slice(0, 10);
    const id = randomUUID();
    await transaction(async (connection) => {
      await connection.execute(
        "INSERT INTO water_logs (id, user_id, amount_ml, log_date) VALUES (?, ?, ?, ?)",
        [id, req.user.id, payload.amountMl, logDate]
      );
    });
    res.status(201).json({ id, message: "Water log berhasil ditambahkan." });
  })
);

module.exports = router;
