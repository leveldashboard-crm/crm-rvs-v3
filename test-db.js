const postgres = require('postgres');

const commonPasswords = ['', 'postgres', 'password', 'admin', 'root', '123456', 'LAdSwzGwqPcNuUZE'];
const userList = ['postgres'];

async function test() {
  for (const user of userList) {
    for (const pass of commonPasswords) {
      const url = `postgres://${user}:${pass}@localhost:5432/postgres`;
      console.log(`Testing: ${user}:${pass || '(none)'}`);
      try {
        const sql = postgres(url, { connect_timeout: 2 });
        const res = await sql`SELECT 1 as connected`;
        console.log(`SUCCESS! URL: ${url}`);
        await sql.end();
        return;
      } catch (e) {
        console.log(`Failed: ${e.message}`);
      }
    }
  }
}

test();
