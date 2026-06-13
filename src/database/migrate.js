const fs = require("fs/promises");
const path = require("path");
const mysql = require("mysql2/promise");
const env = require("../config/env");

const migrationsDir = path.join(__dirname, "migrations");

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  const bootstrap = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: false
  });

  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.db.database}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await bootstrap.end();

  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    multipleStatements: false
  });

  await connection.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [completedRows] = await connection.query("SELECT name FROM migrations");
  const completed = new Set(completedRows.map((row) => row.name));
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    if (completed.has(file)) {
      console.log(`Skipping ${file}`);
      continue;
    }

    console.log(`Running ${file}`);
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    const statements = splitSql(sql);

    await connection.beginTransaction();
    try {
      for (const statement of statements) {
        await connection.query(statement);
      }
      await connection.query("INSERT INTO migrations (name) VALUES (?)", [file]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }

  await connection.end();
  console.log("Migrations completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
