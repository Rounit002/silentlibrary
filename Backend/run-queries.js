// run-queries.js
// This script reads SQL queries from queries.sql, executes them, and then clears the file.

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config(); // Make sure to use the same .env file as your main app

// --- Database Connection ---
// The script uses the same environment variables as your server.js for the DB connection.
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false, // Add SSL support if needed
});

const queryFilePath = path.join(__dirname, 'queries.sql');

async function executeQueries() {
  console.log('Checking for deployment queries to run...');

  let client;
  try {
    // 1. Read the SQL file
    const sql = await fs.readFile(queryFilePath, 'utf-8');

    // If the file is empty or just contains whitespace, do nothing.
    if (!sql.trim()) {
      console.log('No queries found in queries.sql. Skipping.');
      return;
    }

    console.log('Found queries in queries.sql. Attempting to execute...');

    // 2. Connect to the database
    client = await pool.connect();
    console.log('Database connected successfully.');

    // 3. Execute the queries
    await client.query(sql);
    console.log('Successfully executed queries from queries.sql.');

    // 4. Clear the SQL file to prevent re-execution
    await fs.writeFile(queryFilePath, '');
    console.log('Cleared queries.sql to prevent re-running on next deploy.');

  } catch (error) {
    // If the file doesn't exist, it's not an error, just skip.
    if (error.code === 'ENOENT') {
      console.log('queries.sql file not found. Skipping.');
      return;
    }
    // For all other errors, log them.
    console.error('Error executing deployment queries:', error.stack);
    // Exit with an error code to potentially stop a deployment pipeline
    process.exit(1);
  } finally {
    // 5. Release the database client
    if (client) {
      client.release();
      console.log('Database client released.');
    }
    await pool.end();
    console.log('Database pool closed.');
  }
}

// Run the main function
executeQueries();
