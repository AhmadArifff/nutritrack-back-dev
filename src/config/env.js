const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  appUrl: process.env.APP_URL || "http://localhost:5173",
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "nutritrack"
  },
  jwt: {
    secret: process.env.JWT_SECRET || "change-this-secret-before-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  }
};

module.exports = env;
