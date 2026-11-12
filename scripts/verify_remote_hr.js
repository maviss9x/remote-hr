const sql = require('../app/node_modules/mssql');

const config = {
  user: 'sa',
  password: 'HybridHr@2026',
  server: '127.0.0.1',
  port: 14333,
  database: 'remote_hr',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function checkRemoteHr() {
  const pool = await sql.connect(config);
  console.log('Connected directly to remote_hr successfully!');
  const tables = await pool.request().query("SELECT COUNT(*) as cnt FROM information_schema.tables WHERE TABLE_TYPE = 'BASE TABLE'");
  console.log('Base tables count in remote_hr:', tables.recordset[0].cnt);
  const users = await pool.request().query("SELECT COUNT(*) as cnt FROM users");
  console.log('Total users in remote_hr:', users.recordset[0].cnt);
  await pool.close();
}

checkRemoteHr().catch(err => {
  console.error('Check failed:', err.message);
  process.exit(1);
});

