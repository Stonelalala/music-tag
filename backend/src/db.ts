import Database, { Database as DBType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export const dbDataPath = process.env.DATA_DIR || path.join(__dirname, '../../config');
if (!fs.existsSync(dbDataPath)) {
  fs.mkdirSync(dbDataPath, { recursive: true });
}
export const dbPath = path.join(dbDataPath, 'music_tagger.db');

export const db: DBType = new Database(dbPath);

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
  
  CREATE INDEX IF NOT EXISTS idx_tracks_filepath ON tracks(filepath);
  CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(scrape_status);
`);

// Migrations for existing DBs
try { db.exec("ALTER TABLE tracks ADD COLUMN bitrate INTEGER;"); } catch (e) { }
try { db.exec("ALTER TABLE tracks ADD COLUMN sample_rate INTEGER;"); } catch (e) { }
try { db.exec("ALTER TABLE tracks ADD COLUMN duration REAL;"); } catch (e) { }
try { db.exec("ALTER TABLE tracks ADD COLUMN size INTEGER;"); } catch (e) { }

console.log('✅ SQLite Database initialized at:', dbPath);
