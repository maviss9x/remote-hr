const path = require('path');
const { Client } = require(path.join(__dirname, '../app/node_modules/pg'));

const client = new Client({
  connectionString: 'postgresql://postgres:123postgres123@localhost:5432/hybrid_hr?schema=public'
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL hybrid_hr successfully!');
    
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      const countRes = await client.query(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
      console.log(`Table: ${tableName.padEnd(30)} Rows: ${countRes.rows[0].cnt}`);
    }

    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
