// test-db.js
const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'tutorweb',
  port: 3306
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Connection failed:', err);
  } else {
    console.log('✅ Connected to MySQL');
  }
  connection.end();
});
