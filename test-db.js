require("dotenv").config();

const pool = require("./backend/config/database");

async function testDatabase() {
    try {
        const result = await pool.query("SELECT NOW() AS czas");

        console.log("✅ POŁĄCZENIE Z POSTGRESQL DZIAŁA!");
        console.log("Czas bazy:", result.rows[0].czas);
    } catch (error) {
        console.error("❌ NIE UDAŁO SIĘ POŁĄCZYĆ Z BAZĄ");
        console.error(error.message);
    } finally {
        await pool.end();
    }
}

testDatabase();