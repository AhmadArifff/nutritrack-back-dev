const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { query } = require("../config/database");
const authenticate = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const HttpError = require("../utils/http-error");

const router = express.Router();
const mutationBuckets = new Map();
const IMAGE_DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

function rateLimitAction(req, action, max, windowMs) {
  const now = Date.now();
  const key = `${req.user.id}:${action}`;
  const bucket = mutationBuckets.get(key) || [];
  const fresh = bucket.filter((timestamp) => now - timestamp < windowMs);
  if (fresh.length >= max) {
    throw new HttpError(429, "Terlalu banyak aksi. Coba lagi nanti.");
  }
  fresh.push(now);
  mutationBuckets.set(key, fresh);
}

function validateImageDataUrl(value) {
  if (!value || !String(value).startsWith("data:")) return;
  if (!IMAGE_DATA_URL_RE.test(value)) {
    throw new HttpError(400, "Format gambar harus JPG, PNG, atau WEBP.");
  }
  const base64 = value.split(",")[1] || "";
  const estimatedBytes = Math.ceil((base64.length * 3) / 4);
  if (estimatedBytes > 2 * 1024 * 1024) {
    throw new HttpError(400, "Ukuran gambar maksimal 2 MB.");
  }
}

const challengeSchema = z.object({
  title: z.string().min(2).max(140),
  slug: z.string().max(180).optional().nullable(),
  description: z.string().min(2),
  badge: z.string().max(40).optional().nullable(),
  badgeLabel: z.string().max(40).optional().nullable(),
  badgeTone: z.string().max(30).optional().nullable(),
  badgeVariant: z.enum(["hot", "high_impact", "new", "premium"]).optional(),
  participantsLabel: z.string().max(40).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  iconName: z.string().max(80).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  durationDays: z.coerce.number().int().positive().optional(),
  isPremium: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().optional()
});

const postBaseSchema = z.object({
  authorName: z.string().min(2).max(100).optional(),
  authorBadge: z.string().max(100).optional().nullable(),
  authorAvatarUrl: z.string().optional().nullable(),
  body: z.string().min(2).max(500).optional(),
  content: z.string().min(5).max(500).optional(),
  postType: z.enum(["win", "story", "meal_prep", "challenge_update", "progress"]).optional(),
  visibility: z.enum(["public", "buddies", "private"]).optional(),
  achievementLabel: z.string().max(100).optional().nullable(),
  relatedChallengeId: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  cheersCount: z.coerce.number().int().nonnegative().optional(),
  commentsCount: z.coerce.number().int().nonnegative().optional(),
  sharesCount: z.coerce.number().int().nonnegative().optional()
});

const postSchema = postBaseSchema.superRefine((payload, ctx) => {
  const content = payload.content || payload.body || "";
  if (content.trim().length < 5) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["content"], message: "Content minimal 5 karakter." });
  }
});

const postUpdateSchema = postBaseSchema.partial();

const buddySchema = z.object({
  name: z.string().min(2).max(100),
  meta: z.string().max(160).optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  matchPercent: z.coerce.number().int().min(0).max(100).optional(),
  focus: z.string().max(80).optional().nullable(),
  sortOrder: z.coerce.number().int().optional()
});

const leaderboardSchema = z.object({
  name: z.string().min(2).max(100),
  streakDays: z.coerce.number().int().nonnegative().optional(),
  avatarUrl: z.string().optional().nullable(),
  isTop: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().optional()
});

const commentSchema = z.object({
  body: z.string().min(1).max(280).optional(),
  content: z.string().min(1).max(280).optional()
}).superRefine((payload, ctx) => {
  const content = payload.content || payload.body || "";
  if (!content.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["content"], message: "Komentar wajib diisi." });
  }
});

function cleanText(value = "") {
  return String(value).replace(/<[^>]*>/g, "").trim();
}

function slugify(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function compactNumber(value = 0) {
  const number = Number(value) || 0;
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}k`;
  return String(number);
}

function normalizeChallenge(item) {
  const participantCount = Number(item.joined_count || item.participant_count || 0);
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    description: item.description,
    imageUrl: item.image_url,
    iconName: item.icon_name,
    badgeLabel: item.badge_label || item.badge,
    badgeVariant: item.badge_variant || (item.badge_tone === "purple" ? "high_impact" : "hot"),
    durationDays: item.duration_days || 7,
    category: item.category,
    difficulty: item.difficulty || "medium",
    participantCount,
    participantLabel: `+${compactNumber(participantCount || 1200)}`,
    isJoined: Boolean(item.is_joined),
    isPremium: Boolean(item.is_premium)
  };
}

function normalizePost(item) {
  return {
    id: item.id,
    author: {
      id: item.user_id,
      name: item.author_name,
      avatarUrl: item.author_avatar_url,
      badge: item.achievement_label || item.author_badge
    },
    content: item.content || item.body,
    imageUrl: item.image_url,
    postType: item.post_type || "story",
    achievementLabel: item.achievement_label || item.author_badge,
    createdAt: item.created_at,
    cheersCount: Number(item.cheers_count || 0),
    commentsCount: Number(item.comments_count || 0),
    sharesCount: Number(item.shares_count || 0),
    hasCheered: Boolean(item.is_cheered || item.has_cheered)
  };
}

function normalizeBuddy(item) {
  return {
    id: item.id,
    name: item.name,
    avatarUrl: item.avatar_url,
    matchScore: Number(item.match_percent || item.matchScore || 0),
    focusLabel: item.focus || item.meta || "Wellness Focus",
    meta: item.meta,
    connectionStatus: item.is_connected ? "pending" : "none"
  };
}

function normalizeLeaderboard(item, index) {
  const streak = Number(item.current_streak ?? item.streak_days ?? item.streakDays ?? 0);
  return {
    rank: index + 1,
    userId: item.user_id || item.id,
    name: item.full_name || item.name,
    avatarUrl: item.avatar_url,
    currentStreak: streak,
    longestStreak: Number(item.longest_streak || streak),
    metricLabel: `${streak} Days`,
    isTop: Boolean(item.is_top || index === 0)
  };
}

async function loadOverview(req) {
  const params = { userId: req.user.id };
  const [challenges, leaderboard, buddies, posts, statsRows] = await Promise.all([
    query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM community_challenge_members cm WHERE cm.challenge_id = c.id AND cm.status IN ('joined', 'completed')) AS joined_count,
        EXISTS(SELECT 1 FROM community_challenge_members cm WHERE cm.challenge_id = c.id AND cm.user_id = :userId AND cm.status IN ('joined', 'completed')) AS is_joined
       FROM community_challenges c
       WHERE c.is_active = TRUE
       ORDER BY c.sort_order, c.created_at DESC
       LIMIT 8`,
      params
    ),
    query(
      `SELECT p.id AS user_id, p.full_name, p.avatar_url, COALESCE(us.current_streak, p.streak_days, 0) AS current_streak,
        COALESCE(us.longest_streak, p.streak_days, 0) AS longest_streak
       FROM profiles p
       LEFT JOIN user_streaks us ON us.user_id = p.id
       ORDER BY current_streak DESC, longest_streak DESC
       LIMIT 10`
    ),
    query(
      `SELECT b.*,
        EXISTS(SELECT 1 FROM community_buddy_connections bc WHERE bc.buddy_id = b.id AND bc.user_id = :userId) AS is_connected
       FROM community_buddies b
       ORDER BY b.sort_order, b.match_percent DESC
       LIMIT 6`,
      params
    ),
    query(
      `SELECT p.id, p.user_id, p.author_name, p.author_badge, p.author_avatar_url, p.body AS content, p.image_url,
        p.post_type, p.achievement_label,
        p.cheers_count,
        (SELECT COUNT(*) FROM community_post_comments pc WHERE pc.post_id = p.id AND pc.deleted_at IS NULL) AS comments_count,
        COALESCE(p.shares_count, 0) AS shares_count,
        p.created_at, p.updated_at,
        EXISTS(SELECT 1 FROM community_post_cheers pc WHERE pc.post_id = p.id AND pc.user_id = :userId) AS is_cheered
       FROM community_posts p
       WHERE p.deleted_at IS NULL AND COALESCE(p.visibility, 'public') = 'public'
       ORDER BY p.is_pinned DESC, p.created_at DESC
       LIMIT 4`,
      params
    ),
    query(
      `SELECT
        (SELECT COUNT(*) FROM profiles) AS active_members,
        (SELECT COUNT(*) FROM community_challenges WHERE is_active = TRUE) AS active_challenges,
        (SELECT COUNT(*) FROM community_posts WHERE deleted_at IS NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS success_posts_this_week,
        (SELECT COUNT(*) FROM community_challenge_members WHERE user_id = :userId AND status IN ('joined', 'completed')) AS joined_challenges,
        (SELECT COALESCE(MAX(current_streak), 0) FROM user_streaks WHERE user_id = :userId) AS current_streak,
        (SELECT COUNT(*) FROM community_post_cheers pc JOIN community_posts p ON p.id = pc.post_id WHERE p.user_id = :userId) AS cheers_received,
        (SELECT COUNT(*) FROM community_buddy_connections WHERE user_id = :userId) AS buddy_matches`,
      params
    )
  ]);

  const stats = statsRows[0] || {};
  return {
    hero: {
      title: "Connect with the NutriTrack Tribe",
      subtitle: "Find your accountability partners, join expert-led challenges, and celebrate every milestone with a community that cheers for you.",
      stats: {
        activeMembers: Number(stats.active_members || 0),
        activeChallenges: Number(stats.active_challenges || 0),
        successPostsThisWeek: Number(stats.success_posts_this_week || 0)
      }
    },
    activeChallenges: challenges.map(normalizeChallenge),
    feedPreview: posts.map(normalizePost),
    leaderboard: leaderboard.map(normalizeLeaderboard),
    suggestedBuddies: buddies.map(normalizeBuddy),
    myCommunityStats: {
      joinedChallenges: Number(stats.joined_challenges || 0),
      currentStreak: Number(stats.current_streak || 0),
      cheersReceived: Number(stats.cheers_received || 0),
      buddyMatches: Number(stats.buddy_matches || 0)
    }
  };
}

function assertAffected(result, message) {
  if (!result.affectedRows) throw new HttpError(404, message);
}

function userName(req) {
  return req.user.full_name || "NutriTrack Member";
}

function userAvatar(req) {
  return req.user.avatar_url || "/assets/remote/remote-018-77400e5ef4.png";
}

async function ensureExists(table, id, message) {
  const rows = await query(`SELECT id FROM ${table} WHERE id = :id LIMIT 1`, { id });
  if (!rows.length) throw new HttpError(404, message);
}

router.get(
  "/overview",
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await loadOverview(req));
  })
);

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    const overview = await loadOverview(req);
    res.json({
      challenges: overview.activeChallenges,
      posts: overview.feedPreview,
      leaderboard: overview.leaderboard,
      buddies: overview.suggestedBuddies,
      hero: overview.hero,
      myCommunityStats: overview.myCommunityStats
    });
  })
);

router.get(
  "/feed",
  authenticate,
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30);
    const offset = (page - 1) * limit;
    const type = req.query.type && req.query.type !== "all" ? String(req.query.type) : null;
    const where = ["p.deleted_at IS NULL", "COALESCE(p.visibility, 'public') = 'public'"];
    const params = { userId: req.user.id, limit, offset };

    if (type) {
      where.push("p.post_type = :type");
      params.type = type;
    }

    const rows = await query(
      `SELECT p.id, p.user_id, p.author_name, p.author_badge, p.author_avatar_url, p.body AS content, p.image_url,
        p.post_type, p.achievement_label,
        p.cheers_count,
        (SELECT COUNT(*) FROM community_post_comments pc WHERE pc.post_id = p.id AND pc.deleted_at IS NULL) AS comments_count,
        COALESCE(p.shares_count, 0) AS shares_count,
        p.created_at, p.updated_at,
        EXISTS(SELECT 1 FROM community_post_cheers pc WHERE pc.post_id = p.id AND pc.user_id = :userId) AS is_cheered
       FROM community_posts p
       WHERE ${where.join(" AND ")}
       ORDER BY p.is_pinned DESC, p.created_at DESC
       LIMIT :limit OFFSET :offset`,
      params
    );

    res.json({
      items: rows.map(normalizePost),
      pagination: {
        page,
        limit,
        hasMore: rows.length === limit,
        nextPage: rows.length === limit ? page + 1 : null
      }
    });
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
       (id, title, slug, description, badge, badge_tone, badge_label, badge_variant, participants_label, image_url,
        icon_name, category, difficulty, duration_days, is_premium, created_by, sort_order)
       VALUES (:id, :title, :slug, :description, :badge, :badgeTone, :badgeLabel, :badgeVariant, :participantsLabel,
        :imageUrl, :iconName, :category, :difficulty, :durationDays, :isPremium, :createdBy, :sortOrder)`,
      {
        id,
        title: payload.title,
        slug: payload.slug || slugify(payload.title),
        description: cleanText(payload.description),
        badge: payload.badge || payload.badgeLabel || null,
        badgeTone: payload.badgeTone || (payload.badgeVariant === "high_impact" ? "purple" : "orange"),
        badgeLabel: payload.badgeLabel || payload.badge || null,
        badgeVariant: payload.badgeVariant || "new",
        participantsLabel: payload.participantsLabel || null,
        imageUrl: payload.imageUrl || null,
        iconName: payload.iconName || null,
        category: payload.category || null,
        difficulty: payload.difficulty || "medium",
        durationDays: payload.durationDays || 7,
        isPremium: payload.isPremium || false,
        createdBy: req.user.id,
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
        badge_label = COALESCE(:badgeLabel, badge_label),
        badge_variant = COALESCE(:badgeVariant, badge_variant),
        participants_label = COALESCE(:participantsLabel, participants_label),
        image_url = COALESCE(:imageUrl, image_url),
        icon_name = COALESCE(:iconName, icon_name),
        category = COALESCE(:category, category),
        difficulty = COALESCE(:difficulty, difficulty),
        duration_days = COALESCE(:durationDays, duration_days),
        is_premium = COALESCE(:isPremium, is_premium),
        sort_order = COALESCE(:sortOrder, sort_order)
       WHERE id = :id`,
      {
        id: req.params.id,
        title: payload.title ?? null,
        description: payload.description ?? null,
        badge: payload.badge ?? null,
        badgeTone: payload.badgeTone ?? null,
        badgeLabel: payload.badgeLabel ?? null,
        badgeVariant: payload.badgeVariant ?? null,
        participantsLabel: payload.participantsLabel ?? null,
        imageUrl: payload.imageUrl ?? null,
        iconName: payload.iconName ?? null,
        category: payload.category ?? null,
        difficulty: payload.difficulty ?? null,
        durationDays: payload.durationDays ?? null,
        isPremium: payload.isPremium ?? null,
        sortOrder: payload.sortOrder ?? null
      }
    );
    assertAffected(result, "Challenge tidak ditemukan.");
    res.json({ message: "Challenge berhasil diperbarui." });
  })
);

router.delete(
  "/challenges/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await query("UPDATE community_challenges SET is_active = FALSE WHERE id = :id", { id: req.params.id });
    assertAffected(result, "Challenge tidak ditemukan.");
    res.json({ message: "Challenge berhasil dinonaktifkan." });
  })
);

router.post(
  "/challenges/:id/join",
  authenticate,
  asyncHandler(async (req, res) => {
    await ensureExists("community_challenges", req.params.id, "Challenge tidak ditemukan.");
    const [challenge] = await query("SELECT is_active, is_premium FROM community_challenges WHERE id = :id", { id: req.params.id });
    if (!challenge.is_active) throw new HttpError(400, "Challenge sudah tidak aktif.");
    if (challenge.is_premium) {
      const [profile] = await query("SELECT is_pro FROM profiles WHERE id = :userId", { userId: req.user.id });
      if (!profile?.is_pro) throw new HttpError(403, "Upgrade Pro dibutuhkan untuk mengikuti challenge ini.", "UPGRADE_REQUIRED");
    }
    await query(
      `INSERT INTO community_challenge_members (id, challenge_id, user_id, status)
       VALUES (:id, :challengeId, :userId, 'joined')
       ON DUPLICATE KEY UPDATE status = 'joined'`,
      { id: randomUUID(), challengeId: req.params.id, userId: req.user.id }
    );
    const [{ joined_count: joinedCount }] = await query(
      "SELECT COUNT(*) AS joined_count FROM community_challenge_members WHERE challenge_id = :challengeId",
      { challengeId: req.params.id }
    );
    res.json({ challengeId: req.params.id, isJoined: true, participantCount: joinedCount, status: "joined", message: "Anda sudah bergabung ke challenge." });
  })
);

router.delete(
  "/challenges/:id/join",
  authenticate,
  asyncHandler(async (req, res) => {
    await query(
      "UPDATE community_challenge_members SET status = 'left' WHERE challenge_id = :challengeId AND user_id = :userId",
      { challengeId: req.params.id, userId: req.user.id }
    );
    const [{ joined_count: joinedCount }] = await query(
      "SELECT COUNT(*) AS joined_count FROM community_challenge_members WHERE challenge_id = :challengeId AND status IN ('joined', 'completed')",
      { challengeId: req.params.id }
    );
    res.json({ challengeId: req.params.id, isJoined: false, participantCount: joinedCount, status: "left", message: "Anda keluar dari challenge." });
  })
);

router.post(
  "/posts",
  authenticate,
  asyncHandler(async (req, res) => {
    rateLimitAction(req, "community-post", 10, 60 * 60 * 1000);
    const payload = postSchema.parse(req.body);
    validateImageDataUrl(payload.imageUrl);
    const id = randomUUID();
    const content = cleanText(payload.content || payload.body);
    await query(
      `INSERT INTO community_posts
       (id, user_id, author_name, author_badge, author_avatar_url, body, image_url, post_type, achievement_label,
        related_challenge_id, visibility, cheers_count, comments_count, shares_count)
       VALUES (:id, :userId, :authorName, :authorBadge, :authorAvatarUrl, :body, :imageUrl, :postType,
        :achievementLabel, :relatedChallengeId, :visibility, :cheersCount, :commentsCount, :sharesCount)`,
      {
        id,
        userId: req.user.id,
        authorName: payload.authorName || userName(req),
        authorBadge: payload.authorBadge || payload.achievementLabel || "Community Member",
        authorAvatarUrl: payload.authorAvatarUrl || userAvatar(req),
        body: content,
        imageUrl: payload.imageUrl || null,
        postType: payload.postType || "story",
        achievementLabel: payload.achievementLabel || payload.authorBadge || "Community Member",
        relatedChallengeId: payload.relatedChallengeId || null,
        visibility: payload.visibility || "public",
        cheersCount: payload.cheersCount || 0,
        commentsCount: payload.commentsCount || 0,
        sharesCount: payload.sharesCount || 0
      }
    );
    const [post] = await query(
      `SELECT p.id, p.user_id, p.author_name, p.author_badge, p.author_avatar_url, p.body AS content, p.image_url,
        p.post_type, p.achievement_label, p.cheers_count, p.comments_count, p.shares_count, p.created_at,
        0 AS is_cheered
       FROM community_posts p WHERE p.id = :id`,
      { id }
    );
    res.status(201).json({ message: "Post created successfully", post: normalizePost(post) });
  })
);

router.put(
  "/posts/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = postUpdateSchema.parse(req.body);
    validateImageDataUrl(payload.imageUrl);
    const content = payload.content || payload.body;
    const result = await query(
      `UPDATE community_posts SET
        author_name = COALESCE(:authorName, author_name),
        author_badge = COALESCE(:authorBadge, author_badge),
        author_avatar_url = COALESCE(:authorAvatarUrl, author_avatar_url),
        body = COALESCE(:body, body),
        image_url = COALESCE(:imageUrl, image_url),
        post_type = COALESCE(:postType, post_type),
        achievement_label = COALESCE(:achievementLabel, achievement_label),
        visibility = COALESCE(:visibility, visibility)
       WHERE id = :id AND (user_id = :userId OR user_id IS NULL)`,
      {
        id: req.params.id,
        userId: req.user.id,
        authorName: payload.authorName ?? null,
        authorBadge: payload.authorBadge ?? null,
        authorAvatarUrl: payload.authorAvatarUrl ?? null,
        body: content ? cleanText(content) : null,
        imageUrl: payload.imageUrl ?? null,
        postType: payload.postType ?? null,
        achievementLabel: payload.achievementLabel ?? null,
        visibility: payload.visibility ?? null
      }
    );
    assertAffected(result, "Post tidak ditemukan.");
    res.json({ message: "Post berhasil diperbarui." });
  })
);

router.delete(
  "/posts/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await query("UPDATE community_posts SET deleted_at = NOW() WHERE id = :id AND (user_id = :userId OR user_id IS NULL)", {
      id: req.params.id,
      userId: req.user.id
    });
    assertAffected(result, "Post tidak ditemukan.");
    res.json({ message: "Post berhasil dihapus." });
  })
);

async function toggleCheer(req, res) {
    await ensureExists("community_posts", req.params.id, "Post tidak ditemukan.");
    rateLimitAction(req, "community-cheer", 300, 60 * 60 * 1000);
    const existing = await query(
      "SELECT id FROM community_post_cheers WHERE post_id = :postId AND user_id = :userId LIMIT 1",
      { postId: req.params.id, userId: req.user.id }
    );

    if (existing.length) {
      await query("DELETE FROM community_post_cheers WHERE id = :id", { id: existing[0].id });
      await query("UPDATE community_posts SET cheers_count = GREATEST(cheers_count - 1, 0) WHERE id = :id", { id: req.params.id });
    } else {
      await query(
        "INSERT INTO community_post_cheers (id, post_id, user_id) VALUES (:id, :postId, :userId)",
        { id: randomUUID(), postId: req.params.id, userId: req.user.id }
      );
      await query("UPDATE community_posts SET cheers_count = cheers_count + 1 WHERE id = :id", { id: req.params.id });
    }

    const [post] = await query("SELECT cheers_count FROM community_posts WHERE id = :id", { id: req.params.id });
    res.json({ postId: req.params.id, hasCheered: !existing.length, cheered: !existing.length, cheersCount: post.cheers_count });
}

router.post("/posts/:id/cheer", authenticate, asyncHandler(toggleCheer));
router.patch("/posts/:id/cheer", authenticate, asyncHandler(toggleCheer));

router.patch(
  "/posts/:id/share",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await query("UPDATE community_posts SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = :id", { id: req.params.id });
    assertAffected(result, "Post tidak ditemukan.");
    const [post] = await query("SELECT shares_count FROM community_posts WHERE id = :id", { id: req.params.id });
    res.json({ sharesCount: post.shares_count, message: "Share berhasil dicatat." });
  })
);

router.get(
  "/posts/:id/comments",
  authenticate,
  asyncHandler(async (req, res) => {
    await ensureExists("community_posts", req.params.id, "Post tidak ditemukan.");
    const comments = await query(
      `SELECT id, post_id, user_id, author_name, author_avatar_url, body, created_at, updated_at
       FROM community_post_comments
       WHERE post_id = :postId AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      { postId: req.params.id }
    );
    res.json({
      items: comments.map((comment) => ({
        id: comment.id,
        content: comment.body,
        author: {
          id: comment.user_id,
          name: comment.author_name,
          avatarUrl: comment.author_avatar_url
        },
        createdAt: comment.created_at
      })),
      comments
    });
  })
);

router.post(
  "/posts/:id/comments",
  authenticate,
  asyncHandler(async (req, res) => {
    rateLimitAction(req, "community-comment", 60, 60 * 60 * 1000);
    const payload = commentSchema.parse(req.body);
    const content = cleanText(payload.content || payload.body);
    await ensureExists("community_posts", req.params.id, "Post tidak ditemukan.");
    const id = randomUUID();
    await query(
      `INSERT INTO community_post_comments
       (id, post_id, user_id, author_name, author_avatar_url, body)
       VALUES (:id, :postId, :userId, :authorName, :authorAvatarUrl, :body)`,
      {
        id,
        postId: req.params.id,
        userId: req.user.id,
        authorName: userName(req),
        authorAvatarUrl: userAvatar(req),
        body: content
      }
    );
    await query("UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = :id", { id: req.params.id });
    const [post] = await query("SELECT comments_count FROM community_posts WHERE id = :id", { id: req.params.id });
    res.status(201).json({
      id,
      comment: {
        id,
        content,
        author: { id: req.user.id, name: userName(req), avatarUrl: userAvatar(req) },
        createdAt: new Date().toISOString()
      },
      commentsCount: post.comments_count,
      message: "Komentar berhasil ditambahkan."
    });
  })
);

router.put(
  "/comments/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = commentSchema.parse(req.body);
    const content = cleanText(payload.content || payload.body);
    const result = await query(
      "UPDATE community_post_comments SET body = :body WHERE id = :id AND user_id = :userId",
      { id: req.params.id, userId: req.user.id, body: content }
    );
    assertAffected(result, "Komentar tidak ditemukan.");
    res.json({ message: "Komentar berhasil diperbarui." });
  })
);

router.delete(
  "/comments/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const [comment] = await query("SELECT post_id FROM community_post_comments WHERE id = :id AND user_id = :userId", {
      id: req.params.id,
      userId: req.user.id
    });
    if (!comment) throw new HttpError(404, "Komentar tidak ditemukan.");
    await query("UPDATE community_post_comments SET deleted_at = NOW() WHERE id = :id", { id: req.params.id });
    await query("UPDATE community_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = :id", { id: comment.post_id });
    res.json({ message: "Komentar berhasil dihapus." });
  })
);

router.get(
  "/buddies/suggested",
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);
    const rows = await query(
      `SELECT b.*,
        EXISTS(SELECT 1 FROM community_buddy_connections bc WHERE bc.buddy_id = b.id AND bc.user_id = :userId) AS is_connected
       FROM community_buddies b
       ORDER BY b.match_percent DESC, b.sort_order
       LIMIT :limit`,
      { userId: req.user.id, limit }
    );

    res.json({ items: rows.map(normalizeBuddy) });
  })
);

router.post(
  "/buddies",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = buddySchema.parse(req.body);
    const id = randomUUID();
    await query(
      `INSERT INTO community_buddies (id, name, meta, avatar_url, match_percent, focus, sort_order)
       VALUES (:id, :name, :meta, :avatarUrl, :matchPercent, :focus, :sortOrder)`,
      {
        id,
        name: payload.name,
        meta: payload.meta || null,
        avatarUrl: payload.avatarUrl || null,
        matchPercent: payload.matchPercent || 0,
        focus: payload.focus || null,
        sortOrder: payload.sortOrder || 0
      }
    );
    res.status(201).json({ id, message: "Buddy berhasil dibuat." });
  })
);

router.put(
  "/buddies/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = buddySchema.partial().parse(req.body);
    const result = await query(
      `UPDATE community_buddies SET
        name = COALESCE(:name, name),
        meta = COALESCE(:meta, meta),
        avatar_url = COALESCE(:avatarUrl, avatar_url),
        match_percent = COALESCE(:matchPercent, match_percent),
        focus = COALESCE(:focus, focus),
        sort_order = COALESCE(:sortOrder, sort_order)
       WHERE id = :id`,
      {
        id: req.params.id,
        name: payload.name ?? null,
        meta: payload.meta ?? null,
        avatarUrl: payload.avatarUrl ?? null,
        matchPercent: payload.matchPercent ?? null,
        focus: payload.focus ?? null,
        sortOrder: payload.sortOrder ?? null
      }
    );
    assertAffected(result, "Buddy tidak ditemukan.");
    res.json({ message: "Buddy berhasil diperbarui." });
  })
);

router.delete(
  "/buddies/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await query("DELETE FROM community_buddies WHERE id = :id", { id: req.params.id });
    assertAffected(result, "Buddy tidak ditemukan.");
    res.json({ message: "Buddy berhasil dihapus." });
  })
);

router.post(
  "/buddies/:id/connect",
  authenticate,
  asyncHandler(async (req, res) => {
    await ensureExists("community_buddies", req.params.id, "Buddy tidak ditemukan.");
    await query(
      `INSERT INTO community_buddy_connections (id, buddy_id, user_id, status)
       VALUES (:id, :buddyId, :userId, 'requested')
       ON DUPLICATE KEY UPDATE status = 'requested'`,
      { id: randomUUID(), buddyId: req.params.id, userId: req.user.id }
    );
    res.json({ connected: true, message: "Permintaan buddy terkirim." });
  })
);

router.post(
  "/buddies/:id/request",
  authenticate,
  asyncHandler(async (req, res) => {
    await ensureExists("community_buddies", req.params.id, "Buddy tidak ditemukan.");
    await query(
      `INSERT INTO community_buddy_connections (id, buddy_id, user_id, status)
       VALUES (:id, :buddyId, :userId, 'requested')
       ON DUPLICATE KEY UPDATE status = 'requested'`,
      { id: randomUUID(), buddyId: req.params.id, userId: req.user.id }
    );
    res.json({ targetUserId: req.params.id, connectionStatus: "pending", message: "Permintaan buddy terkirim." });
  })
);

router.delete(
  "/buddies/:id/connect",
  authenticate,
  asyncHandler(async (req, res) => {
    await query("DELETE FROM community_buddy_connections WHERE buddy_id = :buddyId AND user_id = :userId", {
      buddyId: req.params.id,
      userId: req.user.id
    });
    res.json({ connected: false, message: "Buddy connection dibatalkan." });
  })
);

router.get(
  "/leaderboard",
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 30);
    const rows = await query(
      `SELECT p.id AS user_id, p.full_name, p.avatar_url,
        COALESCE(us.current_streak, p.streak_days, 0) AS current_streak,
        COALESCE(us.longest_streak, p.streak_days, 0) AS longest_streak
       FROM profiles p
       LEFT JOIN user_streaks us ON us.user_id = p.id
       ORDER BY current_streak DESC, longest_streak DESC
       LIMIT :limit`,
      { limit }
    );

    res.json({ items: rows.map(normalizeLeaderboard) });
  })
);

router.post(
  "/leaderboard",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = leaderboardSchema.parse(req.body);
    const id = randomUUID();
    await query(
      `INSERT INTO community_leaderboard (id, name, streak_days, avatar_url, is_top, sort_order)
       VALUES (:id, :name, :streakDays, :avatarUrl, :isTop, :sortOrder)`,
      {
        id,
        name: payload.name,
        streakDays: payload.streakDays || 0,
        avatarUrl: payload.avatarUrl || null,
        isTop: payload.isTop || false,
        sortOrder: payload.sortOrder || 0
      }
    );
    res.status(201).json({ id, message: "Leaderboard item berhasil dibuat." });
  })
);

router.put(
  "/leaderboard/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const payload = leaderboardSchema.partial().parse(req.body);
    const result = await query(
      `UPDATE community_leaderboard SET
        name = COALESCE(:name, name),
        streak_days = COALESCE(:streakDays, streak_days),
        avatar_url = COALESCE(:avatarUrl, avatar_url),
        is_top = COALESCE(:isTop, is_top),
        sort_order = COALESCE(:sortOrder, sort_order)
       WHERE id = :id`,
      {
        id: req.params.id,
        name: payload.name ?? null,
        streakDays: payload.streakDays ?? null,
        avatarUrl: payload.avatarUrl ?? null,
        isTop: payload.isTop ?? null,
        sortOrder: payload.sortOrder ?? null
      }
    );
    assertAffected(result, "Leaderboard item tidak ditemukan.");
    res.json({ message: "Leaderboard item berhasil diperbarui." });
  })
);

router.delete(
  "/leaderboard/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await query("DELETE FROM community_leaderboard WHERE id = :id", { id: req.params.id });
    assertAffected(result, "Leaderboard item tidak ditemukan.");
    res.json({ message: "Leaderboard item berhasil dihapus." });
  })
);

module.exports = router;
