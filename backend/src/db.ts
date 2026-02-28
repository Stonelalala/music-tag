import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export const dbDataPath = process.env.DATA_DIR || path.join(__dirname, '../../config');
if (!fs.existsSync(dbDataPath)) {
  fs.mkdirSync(dbDataPath, { recursive: true });
}
export const dbPath = path.join(dbDataPath, 'music_tagger.db');

export const db = new Database(dbPath, { verbose: console.log });

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
    
    -- Scrape state: 0=Pending, 1=Success, 2=Failed, 3=Ignored
    scrape_status INTEGER DEFAULT 0,
    last_scraped_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  -- Prevent slow scans by indexing the filepath
  CREATE INDEX IF NOT EXISTS idx_tracks_filepath ON tracks(filepath);
  CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(scrape_status);
`);

console.log('✅ SQLite Database initialized at:', dbPath);
