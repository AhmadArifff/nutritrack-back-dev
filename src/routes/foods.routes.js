const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { query, transaction } = require("../config/database");
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
  tags: z.array(z.string()).optional(),
  ingredients: z.array(z.object({
    name: z.string().min(1).max(180),
    quantity: z.coerce.number().nonnegative().default(1),
    unit: z.string().max(40).default("porsi"),
    category: z.string().max(80).default("Groceries")
  })).optional()
});

async function attachIngredients(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map((_, index) => `:id${index}`).join(", ");
  const params = ids.reduce((acc, id, index) => ({ ...acc, [`id${index}`]: id }), {});
  const ingredientRows = await query(
    `SELECT food_id, ingredient_name AS name, quantity_per_serving AS quantity, unit, category, sort_order AS sortOrder
     FROM food_ingredients
     WHERE food_id IN (${placeholders})
     ORDER BY food_id, sort_order, ingredient_name`,
    params
  );
  const grouped = ingredientRows.reduce((acc, item) => {
    if (!acc[item.food_id]) acc[item.food_id] = [];
    acc[item.food_id].push({
      name: item.name,
      quantity: Number(item.quantity || 0),
      unit: item.unit,
      category: item.category,
      sortOrder: item.sortOrder
    });
    return acc;
  }, {});
  return rows.map((row) => ({ ...row, ingredients: grouped[row.id] || [] }));
}

async function replaceIngredients(connection, foodId, ingredients = []) {
  await connection.execute("DELETE FROM food_ingredients WHERE food_id = ?", [foodId]);
  if (!ingredients.length) return;
  for (const [index, ingredient] of ingredients.entries()) {
    await connection.execute(
      `INSERT INTO food_ingredients
       (id, food_id, ingredient_name, quantity_per_serving, unit, category, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        foodId,
        ingredient.name,
        ingredient.quantity || 1,
        ingredient.unit || "porsi",
        ingredient.category || "Groceries",
        index + 1
      ]
    );
  }
}

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

    res.json(await attachIngredients(rows));
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "").trim();
    const limit = Math.min(Number(req.query.limit || 30), 500);

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

    // Attach ingredient lists for each food so clients (e.g. Meal Planner)
    // receive full ingredient data for Smart Shopping List features.
    res.json(await attachIngredients(rows));
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

    const [food] = await attachIngredients(rows);
    res.status(rows.length ? 200 : 404).json(food || { message: "Makanan tidak ditemukan." });
  })
);

router.post(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = foodSchema.parse(req.body);
    const id = randomUUID();
    await transaction(async (connection) => {
      await connection.execute(
        `INSERT INTO food_database
         (id, name, name_en, category, sub_category, serving_unit, serving_size_g, calories, protein_g,
          carbohydrates_g, fat_g, fiber_g, sugar_g, sodium_mg, image_url, is_custom, is_public, created_by, tags)
         VALUES
         (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, FALSE, ?, ?)`,
        [
          id,
          payload.name,
          payload.nameEn || null,
          payload.category,
          payload.subCategory || null,
          payload.servingUnit,
          payload.servingSizeG,
          payload.calories,
          payload.proteinG,
          payload.carbohydratesG,
          payload.fatG,
          payload.fiberG,
          payload.sugarG,
          payload.sodiumMg,
          payload.imageUrl || null,
          req.user.id,
          payload.tags ? JSON.stringify(payload.tags) : null
        ]
      );
      await replaceIngredients(connection, id, payload.ingredients?.length ? payload.ingredients : [{
        name: payload.name,
        quantity: 1,
        unit: payload.servingUnit,
        category: payload.subCategory || payload.category || "Groceries"
      }]);
    });
    res.status(201).json({ id, message: "Makanan custom berhasil dibuat." });
  })
);

router.put(
  "/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = foodSchema.partial().parse(req.body);
    await transaction(async (connection) => {
      const [result] = await connection.execute(
        `UPDATE food_database SET
          name = COALESCE(?, name),
          name_en = COALESCE(?, name_en),
          category = COALESCE(?, category),
          sub_category = COALESCE(?, sub_category),
          serving_unit = COALESCE(?, serving_unit),
          serving_size_g = COALESCE(?, serving_size_g),
          calories = COALESCE(?, calories),
          protein_g = COALESCE(?, protein_g),
          carbohydrates_g = COALESCE(?, carbohydrates_g),
          fat_g = COALESCE(?, fat_g),
          fiber_g = COALESCE(?, fiber_g),
          sugar_g = COALESCE(?, sugar_g),
          sodium_mg = COALESCE(?, sodium_mg),
          image_url = COALESCE(?, image_url),
          tags = COALESCE(?, tags)
         WHERE id = ? AND created_by = ?`,
        [
          payload.name ?? null,
          payload.nameEn ?? null,
          payload.category ?? null,
          payload.subCategory ?? null,
          payload.servingUnit ?? null,
          payload.servingSizeG ?? null,
          payload.calories ?? null,
          payload.proteinG ?? null,
          payload.carbohydratesG ?? null,
          payload.fatG ?? null,
          payload.fiberG ?? null,
          payload.sugarG ?? null,
          payload.sodiumMg ?? null,
          payload.imageUrl ?? null,
          payload.tags ? JSON.stringify(payload.tags) : null,
          req.params.id,
          req.user.id
        ]
      );
      if (!result.affectedRows) throw new HttpError(404, "Makanan custom tidak ditemukan.");
      if (payload.ingredients) await replaceIngredients(connection, req.params.id, payload.ingredients);
    });
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
