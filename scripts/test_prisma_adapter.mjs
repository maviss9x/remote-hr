import "dotenv/config";
import { PrismaMssql } from "@prisma/adapter-mssql";
import sql from "mssql";

async function test() {
  try {
    const config = {
      server: "127.0.0.1",
      port: 14333,
      user: "sa",
      password: "HybridHr@2026",
      database: "hybrid_hr",
      options: {
        trustServerCertificate: true,
        encrypt: false,
      },
    };
    
    console.log("Connecting via mssql pool...");
    const pool = await sql.connect(config);
    console.log("Connected to MSSQL pool successfully!");
    const res = await pool.request().query("SELECT @@VERSION as ver, DB_NAME() as db");
    console.log("Result:", res.recordset);

    const adapter = new PrismaMssql(config);
    console.log("PrismaMssql adapter created successfully!");
    await pool.close();
  } catch (err) {
    console.error("Test error:", err);
  }
}

test();
