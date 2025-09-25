import { createClient } from '@libsql/client';
import { HourEntry, Settings, EntryChange, WeekdayAverage } from './types';

type TursoClient = ReturnType<typeof createClient>;

const nextPhase = process.env.NEXT_PHASE;
const isBuildPhase = nextPhase === 'phase-production-build' || nextPhase === 'phase-production-export';

function createTursoClient(): TursoClient {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && authToken) {
    return createClient({ url, authToken });
  }

  if (isBuildPhase) {
    console.warn('[turso] Variables TURSO_DATABASE_URL/TURSO_AUTH_TOKEN no definidas durante la fase de build. Se usará un cliente stub solo para la compilación.');
    const stubError = () => {
      throw new Error('[turso] Se intentó acceder a la base de datos sin credenciales. Define TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en producción.');
    };

    const stub: Partial<TursoClient> = {
      execute: async () => stubError(),
      executeMultiple: async () => stubError(),
      close: async () => undefined,
    };

    return stub as TursoClient;
  }

  throw new Error('TURSO_DATABASE_URL y TURSO_AUTH_TOKEN son necesarios para conectarse a Turso.');
}

class TursoDatabase {
  private client: TursoClient | null = null;

  private getClient(): TursoClient {
    if (!this.client) {
      this.client = createTursoClient();
    }
    return this.client;
  }

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

    const client = this.getClient();
    await client.executeMultiple(createTablesSQL);

    // Initialize default hourly rate if not exists
    const existingRate = await client.execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: ['hourly_rate']
    });

    if (existingRate.rows.length === 0) {
      await client.execute({
        sql: 'INSERT INTO settings (key, value) VALUES (?, ?)',
        args: ['hourly_rate', '50000']
      });
    }
  }

  async addEntry(date: string, hours: number, mode: 'add' | 'replace' = 'add'): Promise<EntryChange> {
    const client = this.getClient();
    const existingResult = await client.execute({
      sql: 'SELECT id, hours FROM entries WHERE date = ?',
      args: [date]
    });

    const existing = existingResult.rows[0];

    if (existing) {
      if (mode === 'add') {
        const newHours = Number(existing.hours) + hours;
        await client.execute({
          sql: 'UPDATE entries SET hours = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?',
          args: [newHours, date]
        });
        return {
          date,
          old_value: Number(existing.hours),
          new_value: newHours
        };
      } else {
        await client.execute({
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
      await client.execute({
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
    const client = this.getClient();
    await client.execute({
      sql: 'UPDATE entries SET date = ?, hours = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [date, hours, id]
    });
  }

  async deleteEntry(id: number): Promise<void> {
    const client = this.getClient();
    await client.execute({
      sql: 'DELETE FROM entries WHERE id = ?',
      args: [id]
    });
  }

  async getEntries(): Promise<HourEntry[]> {
    const client = this.getClient();
    const result = await client.execute('SELECT * FROM entries ORDER BY date DESC');
    return result.rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      date: String(row.date),
      hours: Number(row.hours),
      description: row.description != null ? String(row.description) : '',
      company_id: Number(row.company_id ?? 0),
      project_id: row.project_id != null ? Number(row.project_id) : null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at)
    }));
  }

  async getTotalHours(): Promise<number> {
    const client = this.getClient();
    const result = await client.execute('SELECT COALESCE(SUM(hours), 0) as total FROM entries');
    return Number(result.rows[0].total);
  }

  async getEntryCount(): Promise<number> {
    const client = this.getClient();
    const result = await client.execute('SELECT COUNT(*) as count FROM entries');
    return Number(result.rows[0].count);
  }

  async getSettings(): Promise<Settings> {
    const client = this.getClient();
    const result = await client.execute('SELECT key, value FROM settings');
    const settings: Settings = { hourly_rate: 50000 };

  for (const row of result.rows as unknown as Array<{ key: string; value: unknown }>) {
      if (row.key === 'hourly_rate') {
        settings.hourly_rate = Number(row.value);
      }
    }
    
    return settings;
  }

  async updateSetting(key: string, value: string): Promise<void> {
    const client = this.getClient();
    await client.execute({
      sql: 'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      args: [key, value]
    });
  }

  async setHourlyRate(rate: number): Promise<void> {
    await this.updateSetting('hourly_rate', rate.toString());
  }

  async getWeekdayAverages(): Promise<WeekdayAverage[]> {
    const client = this.getClient();
    const result = await client.execute(`
      SELECT 
        CAST(strftime('%w', date) AS INTEGER) as weekday,
        AVG(hours) as average,
        SUM(hours) as total_hours,
        COUNT(*) as entry_count
      FROM entries 
      GROUP BY CAST(strftime('%w', date) AS INTEGER)
      ORDER BY weekday
    `);

    return result.rows.map((row: Record<string, unknown>) => ({
      weekday: Number(row.weekday),
      average_hours: Number(row.average),
      company_id: 0
    }));
  }

  async fillWithAverages(startDate: string, endDate: string, overwrite: boolean = false): Promise<EntryChange[]> {
    const client = this.getClient();
    const averagesResult = await client.execute(`
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
        const existingResult = await client.execute({
          sql: 'SELECT id, hours FROM entries WHERE date = ?',
          args: [dateStr]
        });

        const existing = existingResult.rows[0];

        if (!existing) {
          await client.execute({
            sql: 'INSERT INTO entries (date, hours) VALUES (?, ?)',
            args: [dateStr, averageHours]
          });
          changes.push({
            date: dateStr,
            old_value: 0,
            new_value: averageHours
          });
        } else if (overwrite) {
          await client.execute({
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
    const client = this.getClient();

    for (const entry of entries) {
      const existingResult = await client.execute({
        sql: 'SELECT id, hours FROM entries WHERE date = ?',
        args: [entry.date]
      });

      const existing = existingResult.rows[0];

      if (existing) {
        await client.execute({
          sql: 'UPDATE entries SET hours = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?',
          args: [entry.hours, entry.date]
        });
        changes.push({
          date: entry.date,
          old_value: Number(existing.hours),
          new_value: entry.hours
        });
      } else {
        await client.execute({
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