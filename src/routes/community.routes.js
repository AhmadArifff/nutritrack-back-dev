const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { query } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const HttpError = require("../utils/http-error");

const router = express.Router();

const challengeSchema = z.object({
  title: z.string().min(2).max(140),
  description: z.string().min(2),
  badge: z.string().max(40).optional().nullable(),
  badgeTone: z.string().max(30).optional().nullable(),
  participantsLabel: z.string().max(40).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().optional()
});

const postSchema = z.object({
  authorName: z.string().min(2).max(100),
  authorBadge: z.string().max(100).optional().nullable(),
  authorAvatarUrl: z.string().optional().nullable(),
  body: z.string().min(2),
  imageUrl: z.string().optional().nullable(),
  cheersCount: z.coerce.number().int().nonnegative().optional(),
  commentsCount: z.coerce.number().int().nonnegative().optional()
});

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const [challenges, leaderboard, buddies, posts] = await Promise.all([
      query("SELECT * FROM community_challenges WHERE is_active = TRUE ORDER BY sort_order, created_at DESC"),
      query("SELECT * FROM community_leaderboard ORDER BY sort_order, streak_days DESC"),
      query("SELECT * FROM community_buddies ORDER BY sort_order, match_percent DESC"),
      query("SELECT * FROM community_posts ORDER BY created_at DESC LIMIT 12")
    ]);

    res.json({ challenges, leaderboard, buddies, posts });
  })
);

router.post(
  "/challenges",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = challengeSchema.parse(req.body);
    const id = randomUUID();
    await query(
      `INSERT INTO community_challenges
       (id, title, description, badge, badge_tone, participants_label, image_url, sort_order)
       VALUES (:id, :title, :description, :badge, :badgeTone, :participantsLabel, :imageUrl, :sortOrder)`,
      {
        id,
        title: payload.title,
        description: payload.description,
        badge: payload.badge || null,
        badgeTone: payload.badgeTone || "orange",
        participantsLabel: payload.participantsLabel || null,
        imageUrl: payload.imageUrl || null,
        sortOrder: payload.sortOrder || 0
      }
    );
    res.status(201).json({ id, message: "Challenge berhasil dibuat." });
  })
);

router.put(
  "/challenges/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = challengeSchema.partial().parse(req.body);
    const result = await query(
      `UPDATE community_challenges SET
        title = COALESCE(:title, title),
        description = COALESCE(:description, description),
        badge = COALESCE(:badge, badge),
        badge_tone = COALESCE(:badgeTone, badge_tone),
        participants_label = COALESCE(:participantsLabel, participants_label),
        image_url = COALESCE(:imageUrl, image_url),
        sort_order = COALESCE(:sortOrder, sort_order)
       WHERE id = :id`,
      {
        id: req.params.id,
        title: payload.title ?? null,
        description: payload.description ?? null,
        badge: payload.badge ?? null,
        badgeTone: payload.badgeTone ?? null,
        participantsLabel: payload.participantsLabel ?? null,
        imageUrl: payload.imageUrl ?? null,
        sortOrder: payload.sortOrder ?? null
      }
    );
    if (!result.affectedRows) throw new HttpError(404, "Challenge tidak ditemukan.");
    res.json({ message: "Challenge berhasil diperbarui." });
  })
);

router.delete(
  "/challenges/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await query("UPDATE community_challenges SET is_active = FALSE WHERE id = :id", { id: req.params.id });
    if (!result.affectedRows) throw new HttpError(404, "Challenge tidak ditemukan.");
    res.json({ message: "Challenge berhasil dinonaktifkan." });
  })
);

router.post(
  "/posts",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = postSchema.parse(req.body);
    const id = randomUUID();
    await query(
      `INSERT INTO community_posts
       (id, author_name, author_badge, author_avatar_url, body, image_url, cheers_count, comments_count)
       VALUES (:id, :authorName, :authorBadge, :authorAvatarUrl, :body, :imageUrl, :cheersCount, :commentsCount)`,
      {
        id,
        authorName: payload.authorName,
        authorBadge: payload.authorBadge || null,
        authorAvatarUrl: payload.authorAvatarUrl || null,
        body: payload.body,
        imageUrl: payload.imageUrl || null,
        cheersCount: payload.cheersCount || 0,
        commentsCount: payload.commentsCount || 0
      }
    );
    res.status(201).json({ id, message: "Post komunitas berhasil dibuat." });
  })
);

router.delete(
  "/posts/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await query("DELETE FROM community_posts WHERE id = :id", { id: req.params.id });
    if (!result.affectedRows) throw new HttpError(404, "Post tidak ditemukan.");
    res.json({ message: "Post berhasil dihapus." });
  })
);

module.exports = router;
