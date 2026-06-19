const { Pool } = require("pg");
const url = "postgresql://dtfm_user:***@localhost:5432/dtfm_db";
const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
pool.query("SELECT 1").then(r => {
  console.log("OK:", JSON.stringify(r.rows));
  pool.end();
}).catch(e => {
  console.error("FAIL:", e.message);
  pool.end();
});
