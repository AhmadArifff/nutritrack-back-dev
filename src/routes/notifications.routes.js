const express = require("express");
const { query } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

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

module.exports = router;
