// database.js
const sqlite3 = require('sqlite3').verbose();
// Use ':memory:' for testing or 'badwords.db' for persistent storage
const db = new sqlite3.Database('badwords.db', (err) => {
    if (err) {
        console.error("Error opening database", err.message);
    } else {
        console.log("Connected to the badwords database.");
    }
});

db.serialize(() => {
  // Create team table with total_due
  db.run(`
    CREATE TABLE IF NOT EXISTS team (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE, -- Added UNIQUE constraint for name
      small_bad_words INTEGER DEFAULT 0,
      hard_bad_words INTEGER DEFAULT 0,
      total_due REAL DEFAULT 0.0 -- Added total_due column
    )
  `, (err) => {
      if (err) console.error("Error creating team table", err.message);
  });

  // Create daily_increases table
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_increases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER,
      date TEXT NOT NULL,
      money_increase REAL DEFAULT 0,
      FOREIGN KEY (team_id) REFERENCES team(id) ON DELETE CASCADE -- Added ON DELETE CASCADE
    )
  `, (err) => {
      if (err) console.error("Error creating daily_increases table", err.message);
  });

   // Add index for performance on daily lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_daily_increases_team_date ON daily_increases (team_id, date)`, (err) => {
      if(err) console.error("Error creating index", err.message);
  });


  // --- Data Insertion ---
  // Calculate initial total_due for existing members if needed (run once)
  // db.run(`UPDATE team SET total_due = (small_bad_words * 0.2) + (hard_bad_words * 1.0) WHERE total_due = 0.0 OR total_due IS NULL;`, (err) => {
  //   if (err) console.error("Error updating initial total_due", err.message);
  //   else console.log("Initial total_due calculation applied if needed.");
  // });


  // Insert team members if they don't exist
  const stmt = db.prepare('INSERT OR IGNORE INTO team (name, small_bad_words, hard_bad_words, total_due) VALUES (?, ?, ?, ?)');
  const sampleData = [
    ['Rogerly', 0, 0], ['Alain', 0, 0], ['Amélie', 0, 0], ['Jacques', 0, 0],
    ['Severo', 0, 0], ['Laurent', 0, 0], ['Catherine', 0, 0], ['Constantin', 0, 0],
    ['Jeremy', 0, 0], ['Jorge', 0, 0], ['Matteo', 0, 0], ['Zine', 0, 0],
    ['Mikayil', 12, 0], ['Sabrine', 0, 0], ['Serge', 0, 0], ['Mélanie', 0, 0],
    ['Sandrine', 0, 0], ['Quentin', 0, 0], ['Vincent', 0, 0], ['Marie Claire', 0, 0],
    ['Antoine', 0, 0], ['Thibault', 4, 5]
  ];
  // Insert with default 0 for counts and total_due
  sampleData.forEach(data => stmt.run(data[0], data[1], data[2], 0.0)); // Explicitly set initial total_due to 0
  stmt.finalize((err) => {
       if(err) console.error("Error finalizing statement", err.message);
  });

});

module.exports = db;