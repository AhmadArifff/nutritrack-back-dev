const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { query } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const HttpError = require("../utils/http-error");

const router = express.Router();

const notificationSchema = z.object({
  title: z.string().min(1).max(140),
  message: z.string().min(1),
  type: z.enum(["meal_reminder", "hydration", "achievement", "weekly_report", "system"]).default("system"),
  status: z.enum(["unread", "read", "archived"]).default("unread"),
  scheduledAt: z.string().nullable().optional()
});

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const rows = await query(
      `SELECT *
       FROM notifications
       WHERE user_id = :userId
       ORDER BY created_at DESC
       LIMIT :limit`,
      { userId: req.user.id, limit }
    );

    res.json(rows);
  })
);

router.post(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = notificationSchema.parse(req.body);
    const id = randomUUID();

    await query(
      `INSERT INTO notifications (id, user_id, title, message, type, status, scheduled_at)
       VALUES (:id, :userId, :title, :message, :type, :status, :scheduledAt)`,
      {
        id,
        userId: req.user.id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        status: payload.status,
        scheduledAt: payload.scheduledAt || null
      }
    );

    res.status(201).json({ id, message: "Notifikasi berhasil dibuat." });
  })
);

router.patch(
  "/read-all",
  authenticate,
  asyncHandler(async (req, res) => {
    await query(
      `UPDATE notifications
       SET status = 'read', read_at = COALESCE(read_at, NOW())
       WHERE user_id = :userId AND status = 'unread'`,
      { userId: req.user.id }
    );

    res.json({ message: "Semua notifikasi ditandai sudah dibaca." });
  })
);

router.patch(
  "/:id/read",
  authenticate,
  asyncHandler(async (req, res) => {
    await query(
      `UPDATE notifications
       SET status = 'read', read_at = NOW()
       WHERE id = :id AND user_id = :userId`,
      { id: req.params.id, userId: req.user.id }
    );

    res.json({ message: "Notifikasi ditandai sudah dibaca." });
  })
);

router.put(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = notificationSchema.partial().parse(req.body);
    const result = await query(
      `UPDATE notifications
       SET title = COALESCE(:title, title),
           message = COALESCE(:message, message),
           type = COALESCE(:type, type),
           status = COALESCE(:status, status),
           scheduled_at = COALESCE(:scheduledAt, scheduled_at),
           read_at = CASE WHEN :status = 'read' THEN COALESCE(read_at, NOW()) ELSE read_at END
       WHERE id = :id AND user_id = :userId`,
      {
        id: req.params.id,
        userId: req.user.id,
        title: payload.title || null,
        message: payload.message || null,
        type: payload.type || null,
        status: payload.status || null,
        scheduledAt: payload.scheduledAt || null
      }
    );

    if (!result.affectedRows) {
      throw new HttpError(404, "Notifikasi tidak ditemukan.");
    }

    res.json({ message: "Notifikasi berhasil diperbarui." });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await query("DELETE FROM notifications WHERE id = :id AND user_id = :userId", {
      id: req.params.id,
      userId: req.user.id
    });

    if (!result.affectedRows) {
      throw new HttpError(404, "Notifikasi tidak ditemukan.");
    }

    res.json({ message: "Notifikasi berhasil dihapus." });
  })
);

module.exports = router;
