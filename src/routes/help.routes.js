const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { query } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const HttpError = require("../utils/http-error");

const router = express.Router();

const faqSchema = z.object({
  question: z.string().min(2).max(220),
  answer: z.string().min(2),
  category: z.string().max(80).optional(),
  sortOrder: z.coerce.number().int().optional()
});

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || "").trim();
    const faqParams = search ? { search: `%${search}%` } : {};
    const faqWhere = search ? "WHERE question LIKE :search OR answer LIKE :search" : "";

    const [categories, tutorials, faqs] = await Promise.all([
      query("SELECT * FROM help_categories ORDER BY sort_order, title"),
      query("SELECT * FROM help_tutorials ORDER BY sort_order, title"),
      query(`SELECT * FROM help_faqs ${faqWhere} ORDER BY sort_order, question`, faqParams)
    ]);

    res.json({ categories, tutorials, faqs });
  })
);

router.post(
  "/faqs",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = faqSchema.parse(req.body);
    const id = randomUUID();
    await query(
      `INSERT INTO help_faqs (id, question, answer, category, sort_order)
       VALUES (:id, :question, :answer, :category, :sortOrder)`,
      {
        id,
        question: payload.question,
        answer: payload.answer,
        category: payload.category || "general",
        sortOrder: payload.sortOrder || 0
      }
    );
    res.status(201).json({ id, message: "FAQ berhasil dibuat." });
  })
);

router.put(
  "/faqs/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = faqSchema.partial().parse(req.body);
    const result = await query(
      `UPDATE help_faqs SET
        question = COALESCE(:question, question),
        answer = COALESCE(:answer, answer),
        category = COALESCE(:category, category),
        sort_order = COALESCE(:sortOrder, sort_order)
       WHERE id = :id`,
      {
        id: req.params.id,
        question: payload.question ?? null,
        answer: payload.answer ?? null,
        category: payload.category ?? null,
        sortOrder: payload.sortOrder ?? null
      }
    );
    if (!result.affectedRows) throw new HttpError(404, "FAQ tidak ditemukan.");
    res.json({ message: "FAQ berhasil diperbarui." });
  })
);

router.delete(
  "/faqs/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await query("DELETE FROM help_faqs WHERE id = :id", { id: req.params.id });
    if (!result.affectedRows) throw new HttpError(404, "FAQ tidak ditemukan.");
    res.json({ message: "FAQ berhasil dihapus." });
  })
);

module.exports = router;
