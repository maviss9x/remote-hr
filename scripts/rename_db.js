const sql = require('../app/node_modules/mssql');

const config = {
  user: 'sa',
  password: 'HybridHr@2026',
  server: '127.0.0.1',
  port: 14333,
  database: 'master',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function renameDatabase() {
  const pool = await sql.connect(config);
  console.log('Connected to SQL Server master database.');
  
  // Kiểm tra nếu remote_hr đã tồn tại
  const checkResult = await pool.request().query("SELECT database_id FROM sys.databases WHERE name = 'remote_hr'");
  if (checkResult.recordset.length > 0) {
    console.log("Database 'remote_hr' already exists!");
    await pool.close();
    return;
  }

  console.log("Renaming 'hybrid_hr' to 'remote_hr'...");
  await pool.request().query(`
    ALTER DATABASE hybrid_hr SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    ALTER DATABASE hybrid_hr MODIFY NAME = remote_hr;
    ALTER DATABASE remote_hr SET MULTI_USER;
  `);
  
  console.log("Renamed successfully!");

  const dbs = await pool.request().query("SELECT name FROM sys.databases WHERE name IN ('hybrid_hr', 'remote_hr')");
  console.log('Database verification:', dbs.recordset.map(r => r.name));
  await pool.close();
}

renameDatabase().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
