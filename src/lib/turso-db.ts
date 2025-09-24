import { createClient } from '@libsql/client';
import { HourEntry, Settings, EntryChange, WeekdayAverage } from './types';

// Create Turso client
const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

class TursoDatabase {
  private client = client;

  async connect(): Promise<void> {
    // Turso connections are automatic, no explicit connection needed
  }

  async close(): Promise<void> {
    // Turso connections are automatic, no explicit close needed
  }

  async initialize(): Promise<void> {
    // Create tables if they don't exist
    const createTablesSQL = `
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE NOT NULL,
        hours REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
      CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
    `;

    await this.client.executeMultiple(createTablesSQL);

    // Initialize default hourly rate if not exists
    const existingRate = await this.client.execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: ['hourly_rate']
    });

    if (existingRate.rows.length === 0) {
      await this.client.execute({
        sql: 'INSERT INTO settings (key, value) VALUES (?, ?)',
        args: ['hourly_rate', '50000']
      });
    }
  }

  async addEntry(date: string, hours: number, mode: 'add' | 'replace' = 'add'): Promise<EntryChange> {
    const existingResult = await this.client.execute({
      sql: 'SELECT id, hours FROM entries WHERE date = ?',
      args: [date]
    });

    const existing = existingResult.rows[0];

    if (existing) {
      if (mode === 'add') {
        const newHours = Number(existing.hours) + hours;
        await this.client.execute({
          sql: 'UPDATE entries SET hours = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?',
          args: [newHours, date]
        });
        return {
          date,
          old_value: Number(existing.hours),
          new_value: newHours
        };
      } else {
        await this.client.execute({
          sql: 'UPDATE entries SET hours = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?',
          args: [hours, date]
        });
        return {
          date,
          old_value: Number(existing.hours),
          new_value: hours
        };
      }
    } else {
      await this.client.execute({
        sql: 'INSERT INTO entries (date, hours) VALUES (?, ?)',
        args: [date, hours]
      });
      return {
        date,
        old_value: 0,
        new_value: hours
      };
    }
  }

  async updateEntry(id: number, date: string, hours: number): Promise<void> {
    await this.client.execute({
      sql: 'UPDATE entries SET date = ?, hours = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [date, hours, id]
    });
  }

  async deleteEntry(id: number): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM entries WHERE id = ?',
      args: [id]
    });
  }

  async getEntries(): Promise<HourEntry[]> {
    const result = await this.client.execute('SELECT * FROM entries ORDER BY date DESC');
    return result.rows.map(row => ({
      id: Number(row.id),
      date: String(row.date),
      hours: Number(row.hours),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at)
    }));
  }

  async getTotalHours(): Promise<number> {
    const result = await this.client.execute('SELECT COALESCE(SUM(hours), 0) as total FROM entries');
    return Number(result.rows[0].total);
  }

  async getEntryCount(): Promise<number> {
    const result = await this.client.execute('SELECT COUNT(*) as count FROM entries');
    return Number(result.rows[0].count);
  }

  async getSettings(): Promise<Settings> {
    const result = await this.client.execute('SELECT key, value FROM settings');
    const settings: Settings = { hourly_rate: 50000 };
    
    for (const row of result.rows) {
      if (row.key === 'hourly_rate') {
        settings.hourly_rate = Number(row.value);
      }
    }
    
    return settings;
  }

  async updateSetting(key: string, value: string): Promise<void> {
    await this.client.execute({
      sql: 'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      args: [key, value]
    });
  }

  async setHourlyRate(rate: number): Promise<void> {
    await this.updateSetting('hourly_rate', rate.toString());
  }

  async getWeekdayAverages(): Promise<WeekdayAverage[]> {
    const result = await this.client.execute(`
      SELECT 
        CAST(strftime('%w', date) AS INTEGER) as weekday,
        AVG(hours) as average,
        SUM(hours) as total_hours,
        COUNT(*) as entry_count
      FROM entries 
      GROUP BY CAST(strftime('%w', date) AS INTEGER)
      ORDER BY weekday
    `);

    return result.rows.map(row => ({
      weekday: Number(row.weekday),
      average: Number(row.average),
      total_hours: Number(row.total_hours),
      entry_count: Number(row.entry_count)
    }));
  }

  async fillWithAverages(startDate: string, endDate: string, overwrite: boolean = false): Promise<EntryChange[]> {
    const averagesResult = await this.client.execute(`
      SELECT 
        CAST(strftime('%w', date) AS INTEGER) as weekday,
        AVG(hours) as average
      FROM entries 
      GROUP BY CAST(strftime('%w', date) AS INTEGER)
      HAVING COUNT(*) > 0
    `);

    const averages = new Map<number, number>();
    for (const row of averagesResult.rows) {
      averages.set(Number(row.weekday), Number(row.average));
    }

    const changes: EntryChange[] = [];
    // eslint-disable-next-line prefer-const
    let currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);

    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const weekday = currentDate.getDay();
      const averageHours = averages.get(weekday);

      if (averageHours !== undefined) {
        const existingResult = await this.client.execute({
          sql: 'SELECT id, hours FROM entries WHERE date = ?',
          args: [dateStr]
        });

        const existing = existingResult.rows[0];

        if (!existing) {
          await this.client.execute({
            sql: 'INSERT INTO entries (date, hours) VALUES (?, ?)',
            args: [dateStr, averageHours]
          });
          changes.push({
            date: dateStr,
            old_value: 0,
            new_value: averageHours
          });
        } else if (overwrite) {
          await this.client.execute({
            sql: 'UPDATE entries SET hours = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?',
            args: [averageHours, dateStr]
          });
          changes.push({
            date: dateStr,
            old_value: Number(existing.hours),
            new_value: averageHours
          });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return changes;
  }

  async bulkCreateEntries(entries: Array<{ date: string; hours: number }>): Promise<EntryChange[]> {
    const changes: EntryChange[] = [];

    for (const entry of entries) {
      const existingResult = await this.client.execute({
        sql: 'SELECT id, hours FROM entries WHERE date = ?',
        args: [entry.date]
      });

      const existing = existingResult.rows[0];

      if (existing) {
        await this.client.execute({
          sql: 'UPDATE entries SET hours = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?',
          args: [entry.hours, entry.date]
        });
        changes.push({
          date: entry.date,
          old_value: Number(existing.hours),
          new_value: entry.hours
        });
      } else {
        await this.client.execute({
          sql: 'INSERT INTO entries (date, hours) VALUES (?, ?)',
          args: [entry.date, entry.hours]
        });
        changes.push({
          date: entry.date,
          old_value: 0,
          new_value: entry.hours
        });
      }
    }

    return changes;
  }
}

// Singleton instance
let databaseInstance: TursoDatabase | null = null;

export function getDatabase(): TursoDatabase {
  if (!databaseInstance) {
    databaseInstance = new TursoDatabase();
  }
  return databaseInstance;
}

export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();
  await db.connect();
  await db.initialize();
}