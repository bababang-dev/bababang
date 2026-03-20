const mysql = require('mysql2/promise');
async function test() {
  console.log('connecting...');
  try {
    const conn = await mysql.createConnection({
      host: 'rm-3ns4iytea31l92084do.rwlb.rds.aliyuncs.com',
      port: 3306,
      user: 'bababang',
      password: '@caesar1991!',
      database: 'bababang',
      connectTimeout: 10000
    });
    console.log('DB connected!');
    await conn.end();
  } catch(e) {
    console.log('DB failed:', e.code, e.message);
  }
  process.exit(0);
}
test();