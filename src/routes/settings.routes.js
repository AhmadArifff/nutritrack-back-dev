const express = require("express");
const { z } = require("zod");
const { query } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  locale: z.string().max(12).optional(),
  timezone: z.string().max(80).optional(),
  notificationEnabled: z.boolean().optional(),
  mealReminderEnabled: z.boolean().optional(),
  waterReminderEnabled: z.boolean().optional(),
  weeklyReportEnabled: z.boolean().optional()
});

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const rows = await query("SELECT * FROM user_settings WHERE user_id = :userId", { userId: req.user.id });
    res.json(rows[0]);
  })
);

router.put(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = settingsSchema.parse(req.body);

    await query(
      `UPDATE user_settings SET
        theme = COALESCE(:theme, theme),
        locale = COALESCE(:locale, locale),
        timezone = COALESCE(:timezone, timezone),
        notification_enabled = COALESCE(:notificationEnabled, notification_enabled),
        meal_reminder_enabled = COALESCE(:mealReminderEnabled, meal_reminder_enabled),
        water_reminder_enabled = COALESCE(:waterReminderEnabled, water_reminder_enabled),
        weekly_report_enabled = COALESCE(:weeklyReportEnabled, weekly_report_enabled)
       WHERE user_id = :userId`,
      {
        userId: req.user.id,
        theme: payload.theme ?? null,
        locale: payload.locale ?? null,
        timezone: payload.timezone ?? null,
        notificationEnabled: payload.notificationEnabled ?? null,
        mealReminderEnabled: payload.mealReminderEnabled ?? null,
        waterReminderEnabled: payload.waterReminderEnabled ?? null,
        weeklyReportEnabled: payload.weeklyReportEnabled ?? null
      }
    );

    const rows = await query("SELECT * FROM user_settings WHERE user_id = :userId", { userId: req.user.id });
    res.json(rows[0]);
  })
);

module.exports = router;
