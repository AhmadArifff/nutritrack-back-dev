const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { query, transaction } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const { calculateBmi, getBmiCategory } = require("../utils/nutrition");

const router = express.Router();

const weightLogSchema = z.object({
  weightKg: z.coerce.number().positive(),
  bodyFatPercentage: z.coerce.number().nonnegative().optional(),
  muscleMassKg: z.coerce.number().nonnegative().optional(),
  waistCm: z.coerce.number().nonnegative().optional(),
  chestCm: z.coerce.number().nonnegative().optional(),
  hipCm: z.coerce.number().nonnegative().optional(),
  armCm: z.coerce.number().nonnegative().optional(),
  thighCm: z.coerce.number().nonnegative().optional(),
  logDate: z.string().optional(),
  notes: z.string().optional()
});

router.get(
  "/weight",
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit || 30), 365);
    const rows = await query(
      `SELECT *
       FROM weight_logs
       WHERE user_id = :userId
       ORDER BY log_date DESC
       LIMIT :limit`,
      { userId: req.user.id, limit }
    );

    res.json(rows.reverse());
  })
);

router.post(
  "/weight",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = weightLogSchema.parse(req.body);
    const id = randomUUID();
    const date = payload.logDate || new Date().toISOString().slice(0, 10);
    const profileRows = await query("SELECT height_cm FROM profiles WHERE id = :userId", { userId: req.user.id });
    const bmi = calculateBmi(payload.weightKg, profileRows[0]?.height_cm);
    const bmiCategory = getBmiCategory(bmi);

    await transaction(async (connection) => {
      await connection.execute(
        `INSERT INTO weight_logs
         (id, user_id, weight_kg, body_fat_percentage, muscle_mass_kg, waist_cm, chest_cm, hip_cm, arm_cm,
          thigh_cm, bmi, bmi_category, log_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          weight_kg = VALUES(weight_kg),
          body_fat_percentage = VALUES(body_fat_percentage),
          muscle_mass_kg = VALUES(muscle_mass_kg),
          waist_cm = VALUES(waist_cm),
          chest_cm = VALUES(chest_cm),
          hip_cm = VALUES(hip_cm),
          arm_cm = VALUES(arm_cm),
          thigh_cm = VALUES(thigh_cm),
          bmi = VALUES(bmi),
          bmi_category = VALUES(bmi_category),
          notes = VALUES(notes)`,
        [
          id,
          req.user.id,
          payload.weightKg,
          payload.bodyFatPercentage || null,
          payload.muscleMassKg || null,
          payload.waistCm || null,
          payload.chestCm || null,
          payload.hipCm || null,
          payload.armCm || null,
          payload.thighCm || null,
          bmi,
          bmiCategory,
          date,
          payload.notes || null
        ]
      );

      await connection.execute("UPDATE profiles SET current_weight_kg = ? WHERE id = ?", [payload.weightKg, req.user.id]);
    });

    res.status(201).json({ id, bmi, bmiCategory, message: "Progress berat badan berhasil disimpan." });
  })
);

module.exports = router;
