// database.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('badwords.db', (err) => {
    if (err) {
        console.error("Error opening database", err.message);
    } else {
        console.log("Connected to the badwords database.");
    }
});

db.serialize(() => {
  // Create team table - schema should already include total_due
  db.run(`
    CREATE TABLE IF NOT EXISTS team (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      small_bad_words INTEGER DEFAULT 0,
      hard_bad_words INTEGER DEFAULT 0,
      total_due REAL DEFAULT 0.0 -- Already exists from previous steps
    )
  `, (err) => {
      if (err) console.error("Error creating team table", err.message);
  });

  // Create daily_increases table (Unchanged)
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_increases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER,
      date TEXT NOT NULL,
      money_increase REAL DEFAULT 0,
      FOREIGN KEY (team_id) REFERENCES team(id) ON DELETE CASCADE
    )
  `, (err) => {
      if (err) console.error("Error creating daily_increases table", err.message);
  });

   // Add index (Unchanged)
  db.run(`CREATE INDEX IF NOT EXISTS idx_daily_increases_team_date ON daily_increases (team_id, date)`, (err) => {
      if(err) console.error("Error creating index", err.message);
  });


  // --- Data Insertion ---

  // Prepare statement to accept 4 values: name, small, hard, total_due
  // Using INSERT OR IGNORE: This will only insert if the 'name' doesn't already exist.
  // It won't update existing records if you rerun this script.
  const stmt = db.prepare('INSERT OR IGNORE INTO team (name, small_bad_words, hard_bad_words, total_due) VALUES (?, ?, ?, ?)');

  // --- UPDATED sampleData array with 4 values per person ---
  // Format: [Name, Initial Small Count, Initial Hard Count, Initial Total Due]
  // *** YOU CAN CUSTOMIZE THE LAST NUMBER (Initial Total Due) FOR EACH PERSON ***
  const sampleData = [
    // Examples:
    ['Rogerly', 0, 0, 0.0],    // Starts at zero
    ['Alain', 0, 0, 0.0],
    ['Amélie', 0, 0, 0.0],
    ['Jacques', 2, 1, 1.4],    // Example: Starts with 2 small (€0.4) + 1 hard (€1) = €1.4 due
    ['Severo', 0, 0, 0.0],
    ['Laurent', 5, 0, 1.0],    // Example: Starts with 5 small = €1.0 due
    ['Catherine', 0, 0, 0.0],
    ['Constantin', 0, 3, 3.0],  // Example: Starts with 3 hard = €3.0 due
    ['Jeremy', 0, 0, 10.5],   // Example: Completely custom starting value
    ['Jorge', 0, 0, 0.0],
    ['Matteo', 0, 0, 0.0],
    ['Zine', 0, 0, 0.0],
    ['Mikayil', 12, 0, 2.4],   // Original counts, calculated due (12*0.2 = 2.4)
    ['Sabrine', 0, 0, 0.0],
    ['Serge', 0, 0, 0.0],
    ['Mélanie', 0, 0, 0.0],
    ['Sandrine', 0, 0, 0.0],
    ['Quentin', 0, 0, 0.0],
    ['Vincent', 0, 0, 0.0],
    ['Marie Claire', 0, 0, 0.0],
    ['Antoine', 0, 0, 0.0],
    ['Thibault', 4, 5, 5.8]    // Original counts, calculated due (4*0.2 + 5*1 = 5.8)
  ];

  // Loop through data and run the prepared statement with all 4 values
  sampleData.forEach(data => {
    // Basic check to ensure data row has 4 elements
    if (data && data.length === 4) {
      // Pass name, small_count, hard_count, total_due
      stmt.run(data[0], data[1], data[2], data[3], function(err) {
          if (err) {
              console.error(`Error inserting/ignoring ${data[0]}:`, err.message);
          } else {
              // Optional: Log which ones were actually inserted (vs ignored)
              // if (this.changes > 0) {
              //     console.log(`Inserted new member: ${data[0]}`);
              // }
          }
      });
    } else {
        console.warn(`Skipping invalid sample data row: ${JSON.stringify(data)}`);
    }
  });

  // Finalize the statement
  stmt.finalize((err) => {
       if(err) console.error("Error finalizing statement", err.message);
       else console.log("Sample data processed (inserted or ignored).");
  });

});

module.exports = db;