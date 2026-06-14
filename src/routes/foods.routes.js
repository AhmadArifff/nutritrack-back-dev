const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { query } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const HttpError = require("../utils/http-error");

const router = express.Router();

const foodSchema = z.object({
  name: z.string().min(1).max(200),
  nameEn: z.string().max(200).optional().nullable(),
  category: z.enum(["breakfast", "lunch", "dinner", "snack", "drink", "supplement", "other"]).default("other"),
  subCategory: z.string().max(50).optional().nullable(),
  servingUnit: z.string().max(50).default("gram"),
  servingSizeG: z.coerce.number().positive().default(100),
  calories: z.coerce.number().nonnegative(),
  proteinG: z.coerce.number().nonnegative().default(0),
  carbohydratesG: z.coerce.number().nonnegative().default(0),
  fatG: z.coerce.number().nonnegative().default(0),
  fiberG: z.coerce.number().nonnegative().default(0),
  sugarG: z.coerce.number().nonnegative().default(0),
  sodiumMg: z.coerce.number().nonnegative().default(0),
  imageUrl: z.string().optional().nullable(),
  tags: z.array(z.string()).optional()
});

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

router.post(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = foodSchema.parse(req.body);
    const id = randomUUID();
    await query(
      `INSERT INTO food_database
       (id, name, name_en, category, sub_category, serving_unit, serving_size_g, calories, protein_g,
        carbohydrates_g, fat_g, fiber_g, sugar_g, sodium_mg, image_url, is_custom, is_public, created_by, tags)
       VALUES
       (:id, :name, :nameEn, :category, :subCategory, :servingUnit, :servingSizeG, :calories, :proteinG,
        :carbohydratesG, :fatG, :fiberG, :sugarG, :sodiumMg, :imageUrl, TRUE, FALSE, :userId, :tags)`,
      {
        id,
        userId: req.user.id,
        name: payload.name,
        nameEn: payload.nameEn || null,
        category: payload.category,
        subCategory: payload.subCategory || null,
        servingUnit: payload.servingUnit,
        servingSizeG: payload.servingSizeG,
        calories: payload.calories,
        proteinG: payload.proteinG,
        carbohydratesG: payload.carbohydratesG,
        fatG: payload.fatG,
        fiberG: payload.fiberG,
        sugarG: payload.sugarG,
        sodiumMg: payload.sodiumMg,
        imageUrl: payload.imageUrl || null,
        tags: payload.tags ? JSON.stringify(payload.tags) : null
      }
    );
    res.status(201).json({ id, message: "Makanan custom berhasil dibuat." });
  })
);

router.put(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = foodSchema.partial().parse(req.body);
    const result = await query(
      `UPDATE food_database SET
        name = COALESCE(:name, name),
        name_en = COALESCE(:nameEn, name_en),
        category = COALESCE(:category, category),
        sub_category = COALESCE(:subCategory, sub_category),
        serving_unit = COALESCE(:servingUnit, serving_unit),
        serving_size_g = COALESCE(:servingSizeG, serving_size_g),
        calories = COALESCE(:calories, calories),
        protein_g = COALESCE(:proteinG, protein_g),
        carbohydrates_g = COALESCE(:carbohydratesG, carbohydrates_g),
        fat_g = COALESCE(:fatG, fat_g),
        fiber_g = COALESCE(:fiberG, fiber_g),
        sugar_g = COALESCE(:sugarG, sugar_g),
        sodium_mg = COALESCE(:sodiumMg, sodium_mg),
        image_url = COALESCE(:imageUrl, image_url),
        tags = COALESCE(:tags, tags)
       WHERE id = :id AND created_by = :userId`,
      {
        id: req.params.id,
        userId: req.user.id,
        name: payload.name ?? null,
        nameEn: payload.nameEn ?? null,
        category: payload.category ?? null,
        subCategory: payload.subCategory ?? null,
        servingUnit: payload.servingUnit ?? null,
        servingSizeG: payload.servingSizeG ?? null,
        calories: payload.calories ?? null,
        proteinG: payload.proteinG ?? null,
        carbohydratesG: payload.carbohydratesG ?? null,
        fatG: payload.fatG ?? null,
        fiberG: payload.fiberG ?? null,
        sugarG: payload.sugarG ?? null,
        sodiumMg: payload.sodiumMg ?? null,
        imageUrl: payload.imageUrl ?? null,
        tags: payload.tags ? JSON.stringify(payload.tags) : null
      }
    );
    if (!result.affectedRows) throw new HttpError(404, "Makanan custom tidak ditemukan.");
    res.json({ message: "Makanan custom berhasil diperbarui." });
  })
);

router.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await query("DELETE FROM food_database WHERE id = :id AND created_by = :userId", {
      id: req.params.id,
      userId: req.user.id
    });
    if (!result.affectedRows) throw new HttpError(404, "Makanan custom tidak ditemukan.");
    res.json({ message: "Makanan custom berhasil dihapus." });
  })
);

module.exports = router;
