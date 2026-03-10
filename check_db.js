const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'config/music_tagger.db');
const db = new Database(dbPath);

const tracks = db.prepare('SELECT id, title, duration, bitrate FROM tracks LIMIT 10').all();
console.log(JSON.stringify(tracks, null, 2));
