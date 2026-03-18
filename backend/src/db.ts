import Database, { Database as DBType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const dbDataPath = process.env.DATA_DIR || path.join(__dirname, '../../config');
if (!fs.existsSync(dbDataPath)) {
  fs.mkdirSync(dbDataPath, { recursive: true });
}
export const dbPath = path.join(dbDataPath, 'music_tagger.db');

export const db: DBType = new Database(dbPath);
db.pragma('foreign_keys = ON');

const hasColumn = (table: string, column: string) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return columns.some((item) => item.name === column);
};

const hasAllColumns = (table: string, columns: string[]) =>
  columns.every((column) => hasColumn(table, column));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    filepath TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    extension TEXT NOT NULL,
    title TEXT,
    artist TEXT,
    album TEXT,
    year TEXT,
    
    -- Technical Metadata
    bitrate INTEGER,
    sample_rate INTEGER,
    duration REAL,
    size INTEGER,
    
    -- Scrape state: 0=Pending, 1=Success, 2=Failed, 3=Ignored
    scrape_status INTEGER DEFAULT 0,
    last_scraped_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    progress INTEGER DEFAULT 0,
    message TEXT,
    payload TEXT,
    result TEXT,
    logs TEXT,
    parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, track_id)
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    cover TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL,
    track_id TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, track_id)
  );

  CREATE TABLE IF NOT EXISTS play_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT NOT NULL,
    preference_key TEXT NOT NULL,
    preference_value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, preference_key)
  );
  
  CREATE INDEX IF NOT EXISTS idx_tracks_filepath ON tracks(filepath);
  CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(scrape_status);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_play_history_track ON play_history(track_id);
  CREATE INDEX IF NOT EXISTS idx_play_history_time ON play_history(played_at);
`);

// Default admin user check & initial
const adminUsername = process.env.ADMIN_USER || 'admin';
const adminCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?').get(adminUsername) as { count: number };
if (adminCount && adminCount.count === 0) {
  const adminPassword = process.env.ADMIN_PASS || 'admin';
  const hashedPassword = bcrypt.hashSync(adminPassword, 10);
  db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)')
    .run(crypto.randomUUID(), adminUsername, hashedPassword);
  console.log(`👤 Default admin user created (${adminUsername}/${adminPassword})`);
}

// Migrations for existing DBs
try { db.exec("ALTER TABLE tracks ADD COLUMN bitrate INTEGER;"); } catch (e) { }
try { db.exec("ALTER TABLE tracks ADD COLUMN sample_rate INTEGER;"); } catch (e) { }
try { db.exec("ALTER TABLE tracks ADD COLUMN duration REAL;"); } catch (e) { }
try { db.exec("ALTER TABLE tracks ADD COLUMN size INTEGER;"); } catch (e) { }
try { db.exec("ALTER TABLE tracks ADD COLUMN year TEXT;"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE;"); } catch (e) { }
try { db.exec("ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0;"); } catch (e) { }
try { db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);"); } catch (e) { }
try { db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority DESC, created_at DESC);"); } catch (e) { }
try { db.exec("CREATE TABLE IF NOT EXISTS favorites (user_id TEXT NOT NULL, track_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, track_id));"); } catch (e) { }
try { db.exec("CREATE TABLE IF NOT EXISTS playlists (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, cover TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);"); } catch (e) { }
try { db.exec("CREATE TABLE IF NOT EXISTS playlist_tracks (playlist_id TEXT NOT NULL, track_id TEXT NOT NULL, sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (playlist_id, track_id));"); } catch (e) { }
try { db.exec("CREATE TABLE IF NOT EXISTS play_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE, played_at DATETIME DEFAULT CURRENT_TIMESTAMP);"); } catch (e) { }
try { db.exec("CREATE TABLE IF NOT EXISTS user_preferences (user_id TEXT NOT NULL, preference_key TEXT NOT NULL, preference_value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, preference_key));"); } catch (e) { }
if (!hasColumn('favorites', 'created_at')) {
  try { db.exec("ALTER TABLE favorites ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;"); } catch (e) { }
}
if (!hasColumn('playlists', 'cover')) {
  try { db.exec("ALTER TABLE playlists ADD COLUMN cover TEXT;"); } catch (e) { }
}
if (!hasColumn('playlists', 'updated_at')) {
  try { db.exec("ALTER TABLE playlists ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;"); } catch (e) { }
}
if (!hasColumn('playlist_tracks', 'sort_order')) {
  try { db.exec("ALTER TABLE playlist_tracks ADD COLUMN sort_order INTEGER DEFAULT 0;"); } catch (e) { }
}
if (!hasColumn('playlist_tracks', 'created_at')) {
  try { db.exec("ALTER TABLE playlist_tracks ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;"); } catch (e) { }
}
if (!hasColumn('play_history', 'user_id')) {
  try { db.exec("ALTER TABLE play_history ADD COLUMN user_id TEXT;"); } catch (e) { }
}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_play_history_track ON play_history(track_id);"); } catch (e) { }
try { db.exec("CREATE INDEX IF NOT EXISTS idx_play_history_time ON play_history(played_at);"); } catch (e) { }
if (hasColumn('tracks', 'year')) {
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_tracks_year ON tracks(year);"); } catch (e) { }
}
if (hasAllColumns('tasks', ['status', 'priority', 'created_at'])) {
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority DESC, created_at DESC);"); } catch (e) { }
}
if (hasColumn('tasks', 'parent_id')) {
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);"); } catch (e) { }
}
if (hasAllColumns('user_preferences', ['user_id', 'updated_at'])) {
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_user_preferences_updated ON user_preferences(user_id, updated_at DESC);"); } catch (e) { }
}
if (hasColumn('favorites', 'created_at')) {
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON favorites(user_id, created_at DESC);"); } catch (e) { }
}
if (hasColumn('playlists', 'updated_at')) {
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_playlists_user_updated ON playlists(user_id, updated_at DESC);"); } catch (e) { }
}
if (hasColumn('playlist_tracks', 'sort_order') && hasColumn('playlist_tracks', 'created_at')) {
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_sort ON playlist_tracks(playlist_id, track_id, sort_order ASC, created_at ASC);"); } catch (e) { }
}
if (hasColumn('play_history', 'user_id')) {
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_play_history_user_played_at ON play_history(user_id, played_at DESC);"); } catch (e) { }
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_play_history_user_track_latest ON play_history(user_id, track_id, id DESC);"); } catch (e) { }
}

const singleUser = db.prepare(
  'SELECT id FROM users ORDER BY created_at ASC LIMIT 1'
).get() as { id: string } | undefined;
if (singleUser?.id) {
  try {
    db.prepare('UPDATE play_history SET user_id = ? WHERE user_id IS NULL').run(singleUser.id);
  } catch (e) { }
}

console.log('✅ SQLite Database initialized at:', dbPath);
