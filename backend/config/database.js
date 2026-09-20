const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

pool.on("error", (error) => {
    console.error("Błąd PostgreSQL:", error);
});

module.exports = pool;