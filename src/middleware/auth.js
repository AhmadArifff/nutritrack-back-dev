const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { query } = require("../config/database");
const HttpError = require("../utils/http-error");

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new HttpError(401, "Token autentikasi dibutuhkan.");
    }

    const payload = jwt.verify(token, env.jwt.secret);
    const users = await query(
      `SELECT u.id, u.email, u.full_name, u.avatar_url, u.role, p.onboarding_completed
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       WHERE u.id = :id`,
      { id: payload.sub }
    );

    if (!users.length) {
      throw new HttpError(401, "Sesi tidak valid.");
    }

    req.user = users[0];
    next();
  } catch (error) {
    next(error.name === "JsonWebTokenError" ? new HttpError(401, "Token tidak valid.") : error);
  }
}

module.exports = authenticate;
