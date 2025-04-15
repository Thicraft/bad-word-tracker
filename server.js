// server.js

const express = require('express');
const db = require('./database');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

const DAILY_LIMIT = 1.5;
const SMALL_WORD_COST = 0.2;
const HARD_WORD_COST = 1.0;

// Helper function to run DB operations within a transaction
function runTransaction(operations, callback) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    operations((commitErr) => {
      if (commitErr) {
        console.error("Transaction Error:", commitErr.message);
        db.run('ROLLBACK', (rollbackErr) => {
          if (rollbackErr) console.error("Rollback Error:", rollbackErr.message);
          callback(commitErr); // Pass the original error back
        });
      } else {
        db.run('COMMIT', (commitErr) => {
          if (commitErr) {
            console.error("Commit Error:", commitErr.message);
            db.run('ROLLBACK'); // Best effort rollback
            callback(commitErr);
          } else {
            callback(null); // Success
          }
        });
      }
    });
  });
}


// Get all team members with total money, sorted by total money
app.get('/api/team', (req, res) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  db.all(`
    SELECT
        t.id,
        t.name,
        t.small_bad_words,
        t.hard_bad_words,
        t.total_due, -- Select the stored total_due
        COALESCE(SUM(di.money_increase), 0) AS daily_money_increase
    FROM team t
    LEFT JOIN daily_increases di ON t.id = di.team_id AND di.date = ?
    GROUP BY t.id, t.name, t.small_bad_words, t.hard_bad_words, t.total_due -- Group by all non-aggregated columns
    ORDER BY t.total_due DESC -- Order by total_due
  `, [today], (err, rows) => {
    if (err) {
        console.error("GET /api/team Error:", err.message);
        return res.status(500).json({ error: "Failed to retrieve team data." });
    }
    // Add rank (1, 2, 3, etc.) and format numbers
    const rankedRows = rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      total_due: parseFloat(row.total_due.toFixed(2)), // Use stored total_due
      daily_money_increase: parseFloat(row.daily_money_increase.toFixed(2))
    }));
    res.json(rankedRows);
  });
});

// Generic increment function
function handleIncrement(req, res, wordType, standardCost) {
  const today = new Date().toISOString().split('T')[0];
  const teamId = req.params.id;

  // 1. Get current daily increase
  db.get(`
    SELECT COALESCE(SUM(money_increase), 0) AS daily_money_increase
    FROM daily_increases
    WHERE team_id = ? AND date = ?
  `, [teamId, today], (err, row) => {
    if (err) {
        console.error(`GET daily increase error (${wordType}):`, err.message);
        return res.status(500).json({ error: "Failed to check daily limit." });
    }

    const dailyMoneyIncrease = parseFloat(row.daily_money_increase.toFixed(2));

    // 2. Check if limit is already reached
    if (dailyMoneyIncrease >= DAILY_LIMIT) {
      return res.status(400).json({ error: `Daily limit of €${DAILY_LIMIT.toFixed(2)} already reached.` });
    }

    // 3. Calculate remaining allowance and actual monetary increase for this action
    const remainingAllowance = Math.max(0, DAILY_LIMIT - dailyMoneyIncrease);
    const actualIncrease = parseFloat(Math.min(standardCost, remainingAllowance).toFixed(2));

    if (actualIncrease <= 0) {
         return res.status(400).json({ error: `Cannot add more today, limit of €${DAILY_LIMIT.toFixed(2)} reached.` });
    }

    const updateColumn = wordType === 'small' ? 'small_bad_words' : 'hard_bad_words';

    // 4. Perform updates within a transaction
    runTransaction(
      (transactionCallback) => {
        // 4a. Update word count AND total_due in team table
        // We add the 'actualIncrease' to total_due, but always +1 to the word count column
        db.run(`
            UPDATE team
            SET
                ${updateColumn} = ${updateColumn} + 1,
                total_due = total_due + ?
            WHERE id = ?
        `, [actualIncrease, teamId], function(updateErr) { // Pass actualIncrease here
          if (updateErr) return transactionCallback(updateErr);
          if (this.changes === 0) return transactionCallback(new Error('Team member not found')); // Check if update affected rows

          // 4b. Record the actual monetary increase for the day in daily_increases
          db.run(`
            INSERT INTO daily_increases (team_id, date, money_increase)
            VALUES (?, ?, ?)
          `, [teamId, today, actualIncrease], function(insertErr) { // Insert actualIncrease here too
            if (insertErr) return transactionCallback(insertErr);
            transactionCallback(null); // Signal success
          });
        });
      },
      (finalErr) => { // Callback for runTransaction
        if (finalErr) {
            console.error(`Increment transaction error (${wordType}):`, finalErr.message);
            // Provide a more specific error if possible
            const userMessage = finalErr.message === 'Team member not found'
              ? 'Team member not found.'
              : `Failed to record ${wordType} word due to a database error.`;
            return res.status(500).json({ error: userMessage });
        }
        // Return the actual amount added for potential UI feedback (optional)
        res.json({ success: true, added_money: actualIncrease });
      }
    );
  });
}

// Increment small bad words
app.post('/api/team/:id/small', (req, res) => {
  handleIncrement(req, res, 'small', SMALL_WORD_COST);
});

// Increment hard bad words
app.post('/api/team/:id/hard', (req, res) => {
  handleIncrement(req, res, 'hard', HARD_WORD_COST);
});


app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});