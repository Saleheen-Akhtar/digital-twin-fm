const { Pool } = require("pg");
require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const pool = new Pool({
  host: "localhost",
  port: 5432,
  user: "dtfm_user",
  password: process.env.POSTGRES_PASSWORD,
  database: "dtfm_db",
  connectionTimeoutMillis: 5000,
});

pool
  .query("SELECT 1 AS ok")
  .then((r) => {
    console.log("DB OK:", r.rows[0]);
    return pool.end();
  })
  .catch((e) => {
    console.error("DB FAIL:", e.message);
    return pool.end();
  });
