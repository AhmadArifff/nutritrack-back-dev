const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { query, transaction } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const HttpError = require("../utils/http-error");

const router = express.Router();

const mealPlanSchema = z.object({
  planName: z.string().max(100).optional(),
  planDate: z.string(),
  mealType: z.enum(["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "late_snack"]),
  plannedTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
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

const completeSchema = z.object({
  completed: z.coerce.boolean().default(true)
});

function mysqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function toDateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
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

function buildMealReminder(plan, now = new Date()) {
  if (!plan.planned_time || plan.is_completed) return null;
  const isoDate = String(plan.plan_date).slice(0, 10);
  const time = String(plan.planned_time).slice(0, 5);
  const scheduled = new Date(`${isoDate}T${time}:00`);
  if (Number.isNaN(scheduled.getTime())) return null;
  const diffMinutes = (scheduled.getTime() - now.getTime()) / 60000;
  if (diffMinutes > 3 || diffMinutes < -60) return null;
  return {
    scheduled,
    urgency: diffMinutes > 0 ? "before" : "due",
    title: diffMinutes > 0 ? `Waktunya makan sebentar lagi: ${plan.food_name}` : `Reminder makan: ${plan.food_name}`,
    message: diffMinutes > 0
      ? `${plan.food_name} dijadwalkan pukul ${time}. Siapkan meal Anda dalam ${Math.max(1, Math.ceil(diffMinutes))} menit.`
      : `${plan.food_name} dijadwalkan pukul ${time}. Tandai sudah dimakan jika sudah selesai.`
  };
}

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const from = String(req.query.from || new Date().toISOString().slice(0, 10));
    const to = String(req.query.to || from);

    const rows = await query(
      `SELECT
         mp.*,
         COALESCE(mp.target_calories, fd.calories * mp.serving_amount) AS target_calories,
         COALESCE(mp.target_protein_g, fd.protein_g * mp.serving_amount, 0) AS target_protein_g,
         COALESCE(mp.target_carbs_g, fd.carbohydrates_g * mp.serving_amount, 0) AS target_carbs_g,
         COALESCE(mp.target_fat_g, fd.fat_g * mp.serving_amount, 0) AS target_fat_g
       FROM meal_plans mp
       LEFT JOIN food_database fd ON fd.id = mp.food_id
       WHERE mp.user_id = :userId AND mp.plan_date BETWEEN :from AND :to
       ORDER BY plan_date,
         FIELD(meal_type, 'breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'late_snack'),
         planned_time,
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
         COALESCE(fi.category, fd.sub_category, 'Groceries') AS groupName,
         COALESCE(fi.ingredient_name, mp.food_name) AS name,
         SUM(COALESCE(fi.quantity_per_serving, 1) * mp.serving_amount) AS amount,
         COALESCE(fi.unit, mp.serving_unit, fd.serving_unit, 'porsi') AS unit,
         COUNT(DISTINCT mp.id) AS meals,
         GROUP_CONCAT(DISTINCT mp.food_name ORDER BY mp.food_name SEPARATOR ', ') AS menuNames
       FROM meal_plans mp
       LEFT JOIN food_database fd ON fd.id = mp.food_id
       LEFT JOIN food_ingredients fi ON fi.food_id = fd.id
       WHERE mp.user_id = :userId AND mp.plan_date BETWEEN :from AND :to
       GROUP BY groupName, name, unit
       ORDER BY groupName, MIN(COALESCE(fi.sort_order, 99)), name`,
      { userId: req.user.id, from, to }
    );

    const grouped = rows.reduce((acc, row) => {
      const group = row.groupName || "Groceries";
      if (!acc[group]) acc[group] = [];
      acc[group].push({
        name: row.name,
        amount: `${Number(row.amount || 0).toLocaleString("en-US", { maximumFractionDigits: 1 })} ${row.unit}`,
        meals: `${row.meals} meal${Number(row.meals) > 1 ? "s" : ""} - ${row.menuNames || "Meal plan"}`
      });
      return acc;
    }, {});

    res.json(Object.entries(grouped).map(([group, items]) => ({ group, items })));
  })
);

router.get(
  "/reminders",
  authenticate,
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const rows = await query(
      `SELECT *
       FROM meal_plans
       WHERE user_id = :userId
         AND plan_date = :date
         AND planned_time IS NOT NULL
         AND is_completed = FALSE
       ORDER BY planned_time, created_at`,
      { userId: req.user.id, date }
    );

    const dueReminders = rows.map((plan) => ({ plan, reminder: buildMealReminder(plan) })).filter((item) => item.reminder);

    await Promise.all(dueReminders.map(async ({ plan, reminder }) => {
      const existing = await query(
        `SELECT id
         FROM notifications
         WHERE user_id = :userId
           AND type = 'meal_reminder'
           AND entity_type = 'meal_plan'
           AND entity_id = :entityId
           AND scheduled_at = :scheduledAt
         LIMIT 1`,
        {
          userId: req.user.id,
          entityId: plan.id,
          scheduledAt: mysqlDateTime(reminder.scheduled)
        }
      );
      if (existing.length) return;
      await query(
        `INSERT INTO notifications
         (id, user_id, title, message, type, entity_type, entity_id, status, scheduled_at)
         VALUES (:id, :userId, :title, :message, 'meal_reminder', 'meal_plan', :entityId, 'unread', :scheduledAt)`,
        {
          id: randomUUID(),
          userId: req.user.id,
          title: reminder.title,
          message: reminder.message,
          entityId: plan.id,
          scheduledAt: mysqlDateTime(reminder.scheduled)
        }
      );
    }));

    res.json({
      items: dueReminders.map(({ plan, reminder }) => ({
        mealPlanId: plan.id,
        foodName: plan.food_name,
        mealType: plan.meal_type,
        plannedTime: String(plan.planned_time).slice(0, 5),
        scheduledAt: reminder.scheduled.toISOString(),
        urgency: reminder.urgency,
        title: reminder.title,
        message: reminder.message
      }))
    });
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
       (id, user_id, plan_name, plan_date, meal_type, planned_time, food_id, food_name, serving_amount, serving_unit,
        target_calories, target_protein_g, target_carbs_g, target_fat_g, notes)
       VALUES
       (:id, :userId, :planName, :planDate, :mealType, :plannedTime, :foodId, :foodName, :servingAmount, :servingUnit,
        :targetCalories, :targetProteinG, :targetCarbsG, :targetFatG, :notes)`,
      {
        id,
        userId: req.user.id,
        planName: payload.planName || null,
        planDate: payload.planDate,
        mealType: payload.mealType,
        plannedTime: payload.plannedTime || null,
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
    const payload = completeSchema.parse(req.body || {});
    const rows = await query(
      `SELECT
         mp.*,
         COALESCE(mp.target_calories, fd.calories * mp.serving_amount, 0) AS calories,
         COALESCE(mp.target_protein_g, fd.protein_g * mp.serving_amount, 0) AS protein_g,
         COALESCE(mp.target_carbs_g, fd.carbohydrates_g * mp.serving_amount, 0) AS carbohydrates_g,
         COALESCE(mp.target_fat_g, fd.fat_g * mp.serving_amount, 0) AS fat_g,
         COALESCE(fd.fiber_g * mp.serving_amount, 0) AS fiber_g,
         COALESCE(fd.sugar_g * mp.serving_amount, 0) AS sugar_g,
         COALESCE(fd.sodium_mg * mp.serving_amount, 0) AS sodium_mg,
         COALESCE(fd.serving_size_g * mp.serving_amount, NULL) AS serving_size_g
       FROM meal_plans mp
       LEFT JOIN food_database fd ON fd.id = mp.food_id
       WHERE mp.id = :id AND mp.user_id = :userId
       LIMIT 1`,
      { id: req.params.id, userId: req.user.id }
    );

    if (!rows.length) throw new HttpError(404, "Meal plan tidak ditemukan.");

    const plan = rows[0];
    await transaction(async (connection) => {
      if (payload.completed) {
        await connection.execute(
          `UPDATE meal_plans
           SET is_completed = TRUE, completed_at = NOW()
           WHERE id = ? AND user_id = ?`,
          [req.params.id, req.user.id]
        );
        await connection.execute(
          `INSERT INTO food_logs
           (id, user_id, meal_plan_id, food_id, food_name, meal_type, log_date, log_time, serving_amount, serving_unit,
            serving_size_g, calories, protein_g, carbohydrates_g, fat_g, fiber_g, sugar_g, sodium_mg, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIME), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             food_id = VALUES(food_id),
             food_name = VALUES(food_name),
             meal_type = VALUES(meal_type),
             log_date = VALUES(log_date),
             log_time = VALUES(log_time),
             serving_amount = VALUES(serving_amount),
             serving_unit = VALUES(serving_unit),
             serving_size_g = VALUES(serving_size_g),
             calories = VALUES(calories),
             protein_g = VALUES(protein_g),
             carbohydrates_g = VALUES(carbohydrates_g),
             fat_g = VALUES(fat_g),
             fiber_g = VALUES(fiber_g),
             sugar_g = VALUES(sugar_g),
             sodium_mg = VALUES(sodium_mg),
             notes = VALUES(notes)`,
          [
            randomUUID(),
            req.user.id,
            plan.id,
            plan.food_id || null,
            plan.food_name,
            plan.meal_type,
            plan.plan_date,
            plan.planned_time || null,
            plan.serving_amount || 1,
            plan.serving_unit || "porsi",
            plan.serving_size_g || null,
            plan.calories || 0,
            plan.protein_g || 0,
            plan.carbohydrates_g || 0,
            plan.fat_g || 0,
            plan.fiber_g || 0,
            plan.sugar_g || 0,
            plan.sodium_mg || 0,
            plan.notes || "Logged from meal planner checklist"
          ]
        );
      } else {
        await connection.execute(
          `UPDATE meal_plans
           SET is_completed = FALSE, completed_at = NULL
           WHERE id = ? AND user_id = ?`,
          [req.params.id, req.user.id]
        );
        await connection.execute("DELETE FROM food_logs WHERE meal_plan_id = ? AND user_id = ?", [plan.id, req.user.id]);
      }
      await refreshDailySummary(connection, req.user.id, toDateOnly(plan.plan_date));
    });

    res.json({
      id: plan.id,
      isCompleted: payload.completed,
      message: payload.completed ? "Meal plan ditandai sudah dimakan." : "Meal plan dikembalikan ke rencana makan."
    });
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
        planned_time = COALESCE(:plannedTime, planned_time),
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
        plannedTime: payload.plannedTime ?? null,
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
