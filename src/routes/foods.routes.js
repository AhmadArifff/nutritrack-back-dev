const express = require("express");
const { query } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

router.get(
  "/categories",
  authenticate,
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT category, COUNT(*) AS total
       FROM food_database
       WHERE is_public = TRUE OR created_by = :userId
       GROUP BY category
       ORDER BY category`,
      { userId: req.user.id }
    );

    res.json(rows);
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "").trim();
    const limit = Math.min(Number(req.query.limit || 30), 100);

    const params = { userId: req.user.id, limit };
    const filters = ["(is_public = TRUE OR created_by = :userId)"];

    if (search) {
      params.search = `%${search}%`;
      filters.push("(name LIKE :search OR name_en LIKE :search OR sub_category LIKE :search)");
    }

    if (category) {
      params.category = category;
      filters.push("category = :category");
    }

    const rows = await query(
      `SELECT *
       FROM food_database
       WHERE ${filters.join(" AND ")}
       ORDER BY is_indonesian DESC, name ASC
       LIMIT :limit`,
      params
    );

    res.json(rows);
  })
);

router.get(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const rows = await query(
      `SELECT *
       FROM food_database
       WHERE id = :id AND (is_public = TRUE OR created_by = :userId)`,
      { id: req.params.id, userId: req.user.id }
    );

    res.status(rows.length ? 200 : 404).json(rows[0] || { message: "Makanan tidak ditemukan." });
  })
);

module.exports = router;
