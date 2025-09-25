import { createClient, type ResultSet } from '@libsql/client';
import { HourEntry, Settings, WeekdayAverage, User, Company, Project, EntryChange } from './types';

type LibsqlClient = ReturnType<typeof createClient>;

const nextPhase = process.env.NEXT_PHASE;
const isBuildPhase = nextPhase === 'phase-production-build' || nextPhase === 'phase-production-export';

function createDatabaseClient(): LibsqlClient {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return createClient({ url: 'file:data/hours.db' });
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && authToken) {
    return createClient({ url, authToken });
  }

  if (isBuildPhase) {
    console.warn('[turso] Variables TURSO_DATABASE_URL/TURSO_AUTH_TOKEN no definidas durante la fase de build. Se usará un cliente stub solo para la compilación.');

    const stubResponse: ResultSet = {
      columns: [],
      columnTypes: [],
      rows: [] as ResultSet['rows'],
      rowsAffected: 0,
      lastInsertRowid: undefined,
      toJSON() {
        return {
          columns: this.columns,
          columnTypes: this.columnTypes,
          rows: this.rows,
          rowsAffected: this.rowsAffected,
          lastInsertRowid: this.lastInsertRowid,
        };
      }
    };

    const stub: Partial<LibsqlClient> = {
      execute: async (...args: unknown[]) => {
        void args;
        return stubResponse;
      },
      executeMultiple: async (...args: unknown[]) => {
        void args;
        return undefined;
      },
      batch: async (...args: unknown[]) => {
        void args;
        return [] as ResultSet[];
      },
      migrate: async (...args: unknown[]) => {
        void args;
        return [] as ResultSet[];
      },
      close: () => undefined,
      reconnect: () => undefined,
      sync: async () => undefined,
      protocol: 'stub',
      closed: false,
    };

    return stub as LibsqlClient;
  }

  throw new Error('TURSO_DATABASE_URL y TURSO_AUTH_TOKEN son necesarios para conectarse a Turso en producción.');
}
class Database {
  private client: LibsqlClient | null = null;

  private getClient(): LibsqlClient {
    if (!this.client) {
      this.client = createDatabaseClient();
    }
    return this.client;
  }

  async init(): Promise<void> {
    try {
      const client = this.getClient();
      // Create users table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create companies table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS companies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          hourly_rate REAL NOT NULL DEFAULT 0,
          billing_cycle_day INTEGER NOT NULL DEFAULT 1,
          user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create projects table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          company_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          UNIQUE(name, company_id)
        )
      `);

      // Create hour_entries table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS hour_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          hours REAL NOT NULL,
          description TEXT,
          company_id INTEGER NOT NULL,
          project_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
        )
      `);

      await this.ensureProjectColumns();

      // Create weekday_averages table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS weekday_averages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          weekday INTEGER NOT NULL,
          average_hours REAL NOT NULL,
          company_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
          UNIQUE(weekday, company_id)
        )
      `);

    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  private async ensureProjectColumns(): Promise<void> {
    try {
      const client = this.getClient();
      const result = await client.execute({ sql: "PRAGMA table_info('hour_entries')" });
      const hasProjectColumn = result.rows.some((row: Record<string, unknown>) => {
        const name = row.name;
        return typeof name === 'string' && name === 'project_id';
      });

      if (!hasProjectColumn) {
        await client.execute({
          sql: 'ALTER TABLE hour_entries ADD COLUMN project_id INTEGER'
        });
      }
    } catch (error) {
      console.error('Error ensuring project_id column on hour_entries:', error);
      throw error;
    }
  }

  // User methods
  async createUser(email: string, passwordHash: string, name: string): Promise<number> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      args: [email, passwordHash, name]
    });
    return Number(result.lastInsertRowid);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email]
    });
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: Number(row.id),
      email: String(row.email),
      password_hash: String(row.password_hash),
      name: String(row.name),
      created_at: String(row.created_at)
    };
  }

  async getUserById(id: number): Promise<User | null> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [id]
    });
    
    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: Number(row.id),
      email: String(row.email),
      password_hash: String(row.password_hash),
      name: String(row.name),
      created_at: String(row.created_at)
    };
  }

  // Company methods
  async createCompany(name: string, hourlyRate: number, userId: number): Promise<number> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'INSERT INTO companies (name, hourly_rate, user_id) VALUES (?, ?, ?)',
      args: [name, hourlyRate, userId]
    });
    return Number(result.lastInsertRowid);
  }

  async getUserCompanies(userId: number): Promise<Company[]> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM companies WHERE user_id = ? ORDER BY created_at DESC',
      args: [userId]
    });
    
    return result.rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      name: String(row.name),
      hourly_rate: Number(row.hourly_rate),
      billing_cycle_day: Number(row.billing_cycle_day ?? 1),
      user_id: Number(row.user_id),
      created_at: String(row.created_at)
    }));
  }

  async getCompanyById(id: number): Promise<Company | null> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM companies WHERE id = ?',
      args: [id]
    });
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: Number(row.id),
      name: String(row.name),
      hourly_rate: Number(row.hourly_rate),
      billing_cycle_day: Number(row.billing_cycle_day ?? 1),
      user_id: Number(row.user_id),
      created_at: String(row.created_at)
    };
  }

  async updateCompany(id: number, name: string, hourlyRate: number): Promise<void> {
    const client = this.getClient();
    await client.execute({
      sql: 'UPDATE companies SET name = ?, hourly_rate = ? WHERE id = ?',
      args: [name, hourlyRate, id]
    });
  }

  async deleteCompany(id: number): Promise<void> {
    const client = this.getClient();
    await client.execute({
      sql: 'DELETE FROM companies WHERE id = ?',
      args: [id]
    });
  }

  // Project methods
  async createProject(name: string, companyId: number, userId: number): Promise<number> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'INSERT INTO projects (name, company_id, user_id) VALUES (?, ?, ?)',
      args: [name, companyId, userId]
    });
    return Number(result.lastInsertRowid);
  }

  async getProjectById(id: number): Promise<Project | null> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM projects WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: Number(row.id),
      name: String(row.name),
      company_id: Number(row.company_id),
      user_id: Number(row.user_id),
      created_at: String(row.created_at)
    };
  }

  async getCompanyProjects(companyId: number): Promise<Project[]> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM projects WHERE company_id = ? ORDER BY created_at DESC',
      args: [companyId]
    });

    return result.rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      name: String(row.name),
      company_id: Number(row.company_id),
      user_id: Number(row.user_id),
      created_at: String(row.created_at)
    }));
  }

  async getUserProjects(userId: number): Promise<Project[]> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC',
      args: [userId]
    });

    return result.rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      name: String(row.name),
      company_id: Number(row.company_id),
      user_id: Number(row.user_id),
      created_at: String(row.created_at)
    }));
  }

  async updateProject(id: number, name: string): Promise<void> {
    const client = this.getClient();
    await client.execute({
      sql: 'UPDATE projects SET name = ? WHERE id = ?',
      args: [name, id]
    });
  }

  async deleteProject(id: number): Promise<void> {
    const client = this.getClient();
    await client.execute({
      sql: 'DELETE FROM projects WHERE id = ?',
      args: [id]
    });
  }

  // Hour entries methods
  async addEntry(date: string, hours: number, description: string, companyId: number, projectId?: number | null): Promise<number> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'INSERT INTO hour_entries (date, hours, description, company_id, project_id) VALUES (?, ?, ?, ?, ?)',
      args: [date, hours, description, companyId, projectId ?? null]
    });
    return Number(result.lastInsertRowid);
  }

  async getEntryByDate(companyId: number, date: string, projectId?: number | null): Promise<HourEntry | null> {
    let sql = 'SELECT * FROM hour_entries WHERE date = ? AND company_id = ?';
    const args: Array<string | number | null> = [date, companyId];

    if (typeof projectId === 'number') {
      sql += ' AND project_id = ?';
      args.push(projectId);
    } else if (projectId === null) {
      sql += ' AND project_id IS NULL';
    }

    const client = this.getClient();
    const result = await client.execute({ sql, args });
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: Number(row.id),
      date: String(row.date),
      hours: Number(row.hours),
      description: String(row.description ?? ''),
      company_id: Number(row.company_id),
      project_id: row.project_id != null ? Number(row.project_id) : null,
      created_at: String(row.created_at ?? ''),
    };
  }

  async getEntryById(id: number): Promise<HourEntry | null> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM hour_entries WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: Number(row.id),
      date: String(row.date),
      hours: Number(row.hours),
      description: String(row.description ?? ''),
      company_id: Number(row.company_id),
      project_id: row.project_id != null ? Number(row.project_id) : null,
      created_at: String(row.created_at ?? ''),
    };
  }

  async getEntries(companyId: number): Promise<HourEntry[]> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM hour_entries WHERE company_id = ? ORDER BY date DESC, id DESC',
      args: [companyId]
    });
    
    return result.rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      date: String(row.date),
      hours: Number(row.hours),
      description: String(row.description) || '',
      company_id: Number(row.company_id),
      project_id: row.project_id != null ? Number(row.project_id) : null
    }));
  }

  async updateEntry(id: number, date: string, hours: number, description: string, projectId?: number | null): Promise<void> {
    const client = this.getClient();
    if (typeof projectId === 'undefined') {
      await client.execute({
        sql: 'UPDATE hour_entries SET date = ?, hours = ?, description = ? WHERE id = ?',
        args: [date, hours, description, id]
      });
      return;
    }

    await client.execute({
      sql: 'UPDATE hour_entries SET date = ?, hours = ?, description = ?, project_id = ? WHERE id = ?',
      args: [date, hours, description, projectId ?? null, id]
    });
  }

  async deleteEntry(id: number): Promise<void> {
    const client = this.getClient();
    await client.execute({
      sql: 'DELETE FROM hour_entries WHERE id = ?',
      args: [id]
    });
  }

  async getTotalHours(companyId: number): Promise<number> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT COALESCE(SUM(hours), 0) as total FROM hour_entries WHERE company_id = ?',
      args: [companyId]
    });
    return Number(result.rows[0]?.total) || 0;
  }

  async addBulkEntries(entries: { date: string; hours: number; description: string; companyId: number; projectId?: number | null }[]): Promise<void> {
    for (const entry of entries) {
      await this.addEntry(entry.date, entry.hours, entry.description, entry.companyId, entry.projectId ?? null);
    }
  }

  // Weekday averages methods
  async getWeekdayAverages(companyId: number): Promise<WeekdayAverage[]> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM weekday_averages WHERE company_id = ? ORDER BY weekday',
      args: [companyId]
    });
    
    return result.rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      weekday: Number(row.weekday),
      average_hours: Number(row.average_hours),
      company_id: Number(row.company_id)
    }));
  }

  async updateWeekdayAverage(weekday: number, averageHours: number, companyId: number): Promise<void> {
    const client = this.getClient();
    await client.execute({
      sql: `INSERT INTO weekday_averages (weekday, average_hours, company_id) 
            VALUES (?, ?, ?) 
            ON CONFLICT(weekday, company_id) 
            DO UPDATE SET average_hours = excluded.average_hours`,
      args: [weekday, averageHours, companyId]
    });
  }

  async fillWithAverages(startDate: string, endDate: string, companyId: number, overwrite = false): Promise<EntryChange[]> {
    const averages = await this.getWeekdayAverages(companyId);
    if (averages.length === 0) return [];

    const averageMap = new Map(averages.map(avg => [avg.weekday, avg.average_hours]));
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const changes: EntryChange[] = [];
    const client = this.getClient();
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const weekday = date.getDay();
      const averageHours = averageMap.get(weekday);
      
      if (averageHours) {
        const dateString = date.toISOString().split('T')[0];
        
        // Check if entry already exists
        const existingResult = await client.execute({
          sql: 'SELECT id FROM hour_entries WHERE date = ? AND company_id = ?',
          args: [dateString, companyId]
        });
        
        if (existingResult.rows.length === 0) {
          await this.addEntry(dateString, averageHours, 'Filled with average', companyId);
          changes.push({
            date: dateString,
            old_value: 0,
            new_value: averageHours,
          });
        }
        else if (overwrite) {
          const existing = existingResult.rows[0] as Record<string, unknown>;
          await this.updateEntry(Number(existing.id), dateString, averageHours, 'Filled with average');
          changes.push({
            date: dateString,
            old_value: Number(existing.hours),
            new_value: averageHours,
          });
        }
      }
    }
    return changes;
  }

  // Legacy settings methods (kept for compatibility)
  async getSettings(): Promise<Settings> {
    // Return default settings since we now use company-based rates
    return { hourly_rate: 0 };
  }

  async updateSettings(): Promise<void> {
    // No-op since we now use company-based rates
  }

  async updateCompanyRate(companyId: number, hourlyRate: number): Promise<void> {
    const client = this.getClient();
    await client.execute({
      sql: 'UPDATE companies SET hourly_rate = ? WHERE id = ?',
      args: [hourlyRate, companyId]
    });
  }
}

export { Database };
export default Database;

// Singleton instance
let dbInstance: Database | null = null;

export function getDatabase(): Database {
  if (!dbInstance) {
    dbInstance = new Database();
  }
  return dbInstance;
}

export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();
  await db.init();
}