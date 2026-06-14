const compression = require("compression");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const routes = require("./routes");
const errorHandler = require("./middleware/error-handler");

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({ origin: env.appUrl, credentials: true }));
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "nutritrack-backend",
    timestamp: new Date().toISOString()
  });
});

app.use("/api", routes);
app.use((req, res) => res.status(404).json({ message: "Endpoint tidak ditemukan." }));
app.use(errorHandler);

module.exports = app;
