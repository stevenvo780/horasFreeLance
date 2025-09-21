import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { HourEntry, Settings, EntryChange, WeekdayAverage } from './types';

// Configure SQLite for better performance
sqlite3.verbose();

const DB_PATH = path.join(process.cwd(), 'data', 'hours.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class Database {
  private db: sqlite3.Database | null = null;

  async connect(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async initialize(): Promise<void> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        // Create tables
        this.db!.run(`
          CREATE TABLE IF NOT EXISTS hour_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT UNIQUE NOT NULL,
            hours REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        this.db!.run(`
          CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY,
            hourly_rate REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create trigger to update updated_at automatically
        this.db!.run(`
          CREATE TRIGGER IF NOT EXISTS update_hour_entries_timestamp
          AFTER UPDATE ON hour_entries
          BEGIN
            UPDATE hour_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END
        `);

        this.db!.run(`
          CREATE TRIGGER IF NOT EXISTS update_settings_timestamp
          AFTER UPDATE ON settings
          BEGIN
            UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END
        `);

        // Ensure settings record exists
        this.db!.run(`
          INSERT OR IGNORE INTO settings (id, hourly_rate) VALUES (1, NULL)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async addEntry(date: string, hours: number, mode: 'set' | 'accumulate' | 'error' = 'set'): Promise<EntryChange> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');

    // Check if entry exists
    const existing = await new Promise<HourEntry | undefined>((resolve, reject) => {
      this.db!.get('SELECT * FROM hour_entries WHERE date = ?', [date], (err, row) => {
        if (err) reject(err);
        else resolve(row as HourEntry | undefined);
      });
    });
    
    let newValue: number;
    const oldValue = existing?.hours || null;

    if (existing && mode === 'error') {
      throw new Error(`Ya existe un registro para ${date} (${existing.hours} h). Usa modo 'set' o 'accumulate'.`);
    }

    if (!existing || mode === 'set') {
      newValue = hours;
      if (existing) {
        await new Promise<void>((resolve, reject) => {
          this.db!.run('UPDATE hour_entries SET hours = ? WHERE date = ?', [hours, date], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } else {
        await new Promise<void>((resolve, reject) => {
          this.db!.run('INSERT INTO hour_entries (date, hours) VALUES (?, ?)', [date, hours], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } else if (mode === 'accumulate') {
      newValue = existing.hours + hours;
      await new Promise<void>((resolve, reject) => {
        this.db!.run('UPDATE hour_entries SET hours = ? WHERE date = ?', [newValue, date], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      throw new Error(`Modo no soportado: ${mode}`);
    }

    return {
      date,
      old_value: oldValue,
      new_value: Math.round(newValue * 100) / 100 // Round to 2 decimals
    };
  }

  async getEntries(startDate?: string, endDate?: string): Promise<HourEntry[]> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');
    
    let query = 'SELECT * FROM hour_entries';
    const params: string[] = [];

    if (startDate || endDate) {
      const conditions: string[] = [];
      if (startDate) {
        conditions.push('date >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('date <= ?');
        params.push(endDate);
      }
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date ASC';

    return new Promise((resolve, reject) => {
      this.db!.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as HourEntry[]);
      });
    });
  }

  async getWeekdayAverages(): Promise<WeekdayAverage[]> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');

    const query = `
      SELECT 
        CAST(strftime('%w', date) AS INTEGER) as weekday_sqlite,
        ROUND(AVG(hours), 2) as average,
        ROUND(SUM(hours), 2) as total_hours,
        COUNT(*) as entry_count
      FROM hour_entries 
      GROUP BY strftime('%w', date)
      HAVING COUNT(*) > 0
    `;

    const results = await new Promise<Array<{
      weekday_sqlite: number;
      average: number;
      total_hours: number;
      entry_count: number;
    }>>((resolve, reject) => {
      this.db!.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows as Array<{
          weekday_sqlite: number;
          average: number;
          total_hours: number;
          entry_count: number;
        }>);
      });
    });

    // Convert SQLite weekday (0=Sunday) to ISO weekday (0=Monday)
    return results.map(row => ({
      weekday: row.weekday_sqlite === 0 ? 6 : row.weekday_sqlite - 1,
      average: row.average,
      total_hours: row.total_hours,
      entry_count: row.entry_count
    }));
  }

  async fillWithAverages(startDate: string, endDate: string, overwrite = false): Promise<EntryChange[]> {
    const averages = await this.getWeekdayAverages();
    if (averages.length === 0) {
      throw new Error('No hay suficientes datos para calcular promedios por día de la semana.');
    }

    const averageMap = new Map(averages.map(avg => [avg.weekday, avg.average]));
    const changes: EntryChange[] = [];

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    
    for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
      const dateStr = current.toISOString().split('T')[0];
      const weekday = current.getDay() === 0 ? 6 : current.getDay() - 1; // Convert to ISO weekday
      
      const averageHours = averageMap.get(weekday);
      if (averageHours === undefined) continue;

      try {
        const change = await this.addEntry(dateStr, averageHours, overwrite ? 'set' : 'error');
        changes.push(change);
      } catch (error) {
        if (!overwrite && error instanceof Error && error.message.includes('Ya existe')) {
          continue; // Skip existing entries when not overwriting
        }
        throw error;
      }
    }

    return changes;
  }

  async setHourlyRate(rate: number): Promise<void> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');

    return new Promise((resolve, reject) => {
      this.db!.run('UPDATE settings SET hourly_rate = ? WHERE id = 1', [rate], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getSettings(): Promise<Settings> {
    await this.connect();
    if (!this.db) throw new Error('Database not connected');

    const settings = await new Promise<Settings | undefined>((resolve, reject) => {
      this.db!.get('SELECT * FROM settings WHERE id = 1', [], (err, row) => {
        if (err) reject(err);
        else resolve(row as Settings | undefined);
      });
    });
    
    return settings || { id: 1, hourly_rate: null };
  }

  async getTotalHours(startDate?: string, endDate?: string): Promise<number> {
    const entries = await this.getEntries(startDate, endDate);
    return entries.reduce((total, entry) => total + entry.hours, 0);
  }

  async close(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.db = null;
          resolve();
        }
      });
    });
  }
}

// Singleton instance
let dbInstance: Database | null = null;

export function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

// Helper function to initialize database on first use
export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();
  await db.initialize();
}

export { Database };