const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

function openDatabase(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      non_skippable INTEGER NOT NULL DEFAULT 0 CHECK (non_skippable IN (0, 1)),
      completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
      received_at TEXT NOT NULL,
      completed_at TEXT,
      source_created_at TEXT NOT NULL
    )
  `);

  const columns = db.prepare('PRAGMA table_info(checklist_items)').all();
  if (!columns.some((column) => column.name === 'source_created_at')) {
    db.exec('ALTER TABLE checklist_items ADD COLUMN source_created_at TEXT');
    db.exec('UPDATE checklist_items SET source_created_at = received_at WHERE source_created_at IS NULL');
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_items_source
    ON checklist_items(text, source_created_at)
  `);

  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO checklist_items
      (text, non_skippable, completed, received_at, completed_at, source_created_at)
    VALUES (?, ?, 0, ?, NULL, ?)
  `);
  const findBySource = db.prepare(`
    SELECT id FROM checklist_items WHERE text = ? AND source_created_at = ?
  `);

  return {
    addItem({ text, non_skippable, created_at }) {
      const receivedAt = new Date().toISOString();
      const result = insertItem.run(text, non_skippable ? 1 : 0, receivedAt, created_at);
      const existing = findBySource.get(text, created_at);
      return { id: existing.id, created: result.changes === 1 };
    },
    getItems() {
      return db.prepare(`
        SELECT id, text, non_skippable, completed, received_at, completed_at
        FROM checklist_items
        ORDER BY received_at DESC, id DESC
      `).all();
    },
    getPendingNonSkippable() {
      return db.prepare(`
        SELECT id, text, non_skippable, completed, received_at, completed_at
        FROM checklist_items
        WHERE non_skippable = 1 AND completed = 0
        ORDER BY received_at ASC, id ASC
      `).all();
    },
    setCompleted(id, completed) {
      return db.prepare(`
        UPDATE checklist_items
        SET completed = ?,
            completed_at = CASE
              WHEN ? = 1 THEN COALESCE(completed_at, ?)
              ELSE NULL
            END
        WHERE id = ?
      `).run(completed ? 1 : 0, completed ? 1 : 0, new Date().toISOString(), id).changes > 0;
    },
    clearCompleted() {
      return db.prepare('DELETE FROM checklist_items WHERE completed = 1').run().changes;
    },
    close() {
      db.close();
    }
  };
}

module.exports = { openDatabase };
