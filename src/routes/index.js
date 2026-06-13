const express = require("express");
const authRoutes = require("./auth.routes");
const dashboardRoutes = require("./dashboard.routes");
const foodRoutes = require("./foods.routes");
const foodLogRoutes = require("./food-logs.routes");
const mealPlanRoutes = require("./meal-plans.routes");
const profileRoutes = require("./profile.routes");
const progressRoutes = require("./progress.routes");
const settingsRoutes = require("./settings.routes");
const notificationRoutes = require("./notifications.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/foods", foodRoutes);
router.use("/food-logs", foodLogRoutes);
router.use("/meal-plans", mealPlanRoutes);
router.use("/profile", profileRoutes);
router.use("/progress", progressRoutes);
router.use("/settings", settingsRoutes);
router.use("/notifications", notificationRoutes);

module.exports = router;
