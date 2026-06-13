const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const env = require("../config/env");
const { query, transaction } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const HttpError = require("../utils/http-error");

const router = express.Router();

const registerSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email().max(160),
  password: z.string().min(8).max(72)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function signToken(userId) {
  return jwt.sign({ sub: userId }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

async function createDefaultSchedules(connection, userId) {
  const schedules = [
    ["breakfast", "07:00:00", "Waktunya sarapan! Mulai hari dengan baik."],
    ["morning_snack", "10:00:00", "Snack pagi dulu yuk."],
    ["lunch", "12:30:00", "Makan siang sehat jangan terlewat."],
    ["afternoon_snack", "15:30:00", "Saatnya cemilan sore."],
    ["dinner", "19:00:00", "Makan malam sehat."],
    ["late_snack", "21:00:00", "Snack malam opsional."]
  ];

  for (const [mealType, scheduledTime, message] of schedules) {
    await connection.execute(
      `INSERT INTO meal_schedules
       (id, user_id, meal_type, scheduled_time, reminder_enabled, reminder_minutes_before, custom_message, days_of_week)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), userId, mealType, scheduledTime, mealType !== "late_snack", 15, message, "[1,2,3,4,5,6,7]"]
    );
  }
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const existing = await query("SELECT id FROM users WHERE email = :email", { email: payload.email });

    if (existing.length) {
      throw new HttpError(409, "Email sudah terdaftar.");
    }

    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(payload.password, 12);

    await transaction(async (connection) => {
      await connection.execute(
        `INSERT INTO users (id, email, password_hash, full_name, email_verified_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [userId, payload.email, passwordHash, payload.fullName]
      );

      await connection.execute(
        `INSERT INTO profiles
         (id, full_name, target_calories, target_protein_g, target_carbs_g, target_fat_g, target_fiber_g,
          target_water_ml, allergies, cuisine_preferences)
         VALUES (?, ?, 2200, 120, 260, 70, 30, 2500, ?, ?)`,
        [userId, payload.fullName, "[]", "[]"]
      );

      await connection.execute("INSERT INTO user_settings (user_id) VALUES (?)", [userId]);
      await createDefaultSchedules(connection, userId);
    });

    res.status(201).json({
      token: signToken(userId),
      user: {
        id: userId,
        email: payload.email,
        fullName: payload.fullName
      }
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const users = await query("SELECT * FROM users WHERE email = :email", { email: payload.email });

    if (!users.length) {
      throw new HttpError(401, "Email atau kata sandi salah.");
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(payload.password, user.password_hash);

    if (!validPassword) {
      throw new HttpError(401, "Email atau kata sandi salah.");
    }

    res.json({
      token: signToken(user.id),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        role: user.role
      }
    });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT u.id, u.email, u.full_name AS fullName, u.avatar_url AS avatarUrl, u.role,
              p.onboarding_completed AS onboardingCompleted, s.theme, s.locale, s.timezone
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       LEFT JOIN user_settings s ON s.user_id = u.id
       WHERE u.id = :id`,
      { id: req.user.id }
    );

    res.json(rows[0]);
  })
);

module.exports = router;
