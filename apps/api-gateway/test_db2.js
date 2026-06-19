const { Pool } = require("pg");
const p = new Pool({
  host: "localhost", port: 5432, user: "dtfm_user",
  password: "***", connectionString: process.argv.includes("--url") ? undefined : undefined,
  database: "dtfm_db", connectionTimeoutMillis: 5000
});
p.query("SELECT 1").then(r => { console.log("OK:", r.rows); p.end(); })
 .catch(e => { console.error("FAIL:", e.message); p.end(); });
