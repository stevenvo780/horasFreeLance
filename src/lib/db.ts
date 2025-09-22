import { createClient } from '@libsql/client';
import { HourEntry, Settings, WeekdayAverage, User, Company } from './types';

// Use Turso in production, local SQLite in development
const client = createClient({
  url: process.env.NODE_ENV === 'production' 
    ? process.env.TURSO_DATABASE_URL! 
    : 'file:data/hours.db',
  authToken: process.env.NODE_ENV === 'production' 
    ? process.env.TURSO_AUTH_TOKEN 
    : undefined,
});

class Database {
  private client = client;

  async init(): Promise<void> {
    try {
      // Create users table
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create companies table
      await this.client.execute(`
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

      // Create hour_entries table
      await this.client.execute(`
        CREATE TABLE IF NOT EXISTS hour_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          hours REAL NOT NULL,
          description TEXT,
          company_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
        )
      `);

      // Create weekday_averages table
      await this.client.execute(`
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
    await this.client.close();
  }

  // User methods
  async createUser(email: string, passwordHash: string, name: string): Promise<number> {
    const result = await this.client.execute({
      sql: 'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
      args: [email, passwordHash, name]
    });
    return Number(result.lastInsertRowid);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email]
    });
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: Number(row.id),
      email: String(row.email),
      password_hash: String(row.password_hash),
      name: String(row.name),
      created_at: String(row.created_at)
    };
  }

  async getUserById(id: number): Promise<User | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [id]
    });
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
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
    const result = await this.client.execute({
      sql: 'INSERT INTO companies (name, hourly_rate, user_id) VALUES (?, ?, ?)',
      args: [name, hourlyRate, userId]
    });
    return Number(result.lastInsertRowid);
  }

  async getUserCompanies(userId: number): Promise<Company[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM companies WHERE user_id = ? ORDER BY created_at DESC',
      args: [userId]
    });
    
    return result.rows.map(row => ({
      id: Number(row.id),
      name: String(row.name),
      hourly_rate: Number(row.hourly_rate),
      user_id: Number(row.user_id),
      created_at: String(row.created_at)
    }));
  }

  async getCompanyById(id: number): Promise<Company | null> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM companies WHERE id = ?',
      args: [id]
    });
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: Number(row.id),
      name: String(row.name),
      hourly_rate: Number(row.hourly_rate),
      user_id: Number(row.user_id),
      created_at: String(row.created_at)
    };
  }

  async updateCompany(id: number, name: string, hourlyRate: number): Promise<void> {
    await this.client.execute({
      sql: 'UPDATE companies SET name = ?, hourly_rate = ? WHERE id = ?',
      args: [name, hourlyRate, id]
    });
  }

  async deleteCompany(id: number): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM companies WHERE id = ?',
      args: [id]
    });
  }

  // Hour entries methods
  async addEntry(date: string, hours: number, description: string, companyId: number): Promise<number> {
    const result = await this.client.execute({
      sql: 'INSERT INTO hour_entries (date, hours, description, company_id) VALUES (?, ?, ?, ?)',
      args: [date, hours, description, companyId]
    });
    return Number(result.lastInsertRowid);
  }

  async getEntries(companyId: number): Promise<HourEntry[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM hour_entries WHERE company_id = ? ORDER BY date DESC, id DESC',
      args: [companyId]
    });
    
    return result.rows.map(row => ({
      id: Number(row.id),
      date: String(row.date),
      hours: Number(row.hours),
      description: String(row.description) || '',
      company_id: Number(row.company_id)
    }));
  }

  async updateEntry(id: number, date: string, hours: number, description: string): Promise<void> {
    await this.client.execute({
      sql: 'UPDATE hour_entries SET date = ?, hours = ?, description = ? WHERE id = ?',
      args: [date, hours, description, id]
    });
  }

  async deleteEntry(id: number): Promise<void> {
    await this.client.execute({
      sql: 'DELETE FROM hour_entries WHERE id = ?',
      args: [id]
    });
  }

  async getTotalHours(companyId: number): Promise<number> {
    const result = await this.client.execute({
      sql: 'SELECT COALESCE(SUM(hours), 0) as total FROM hour_entries WHERE company_id = ?',
      args: [companyId]
    });
    return Number(result.rows[0]?.total) || 0;
  }

  async addBulkEntries(entries: { date: string; hours: number; description: string; companyId: number }[]): Promise<void> {
    for (const entry of entries) {
      await this.addEntry(entry.date, entry.hours, entry.description, entry.companyId);
    }
  }

  // Weekday averages methods
  async getWeekdayAverages(companyId: number): Promise<WeekdayAverage[]> {
    const result = await this.client.execute({
      sql: 'SELECT * FROM weekday_averages WHERE company_id = ? ORDER BY weekday',
      args: [companyId]
    });
    
    return result.rows.map(row => ({
      id: Number(row.id),
      weekday: Number(row.weekday),
      average_hours: Number(row.average_hours),
      company_id: Number(row.company_id)
    }));
  }

  async updateWeekdayAverage(weekday: number, averageHours: number, companyId: number): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO weekday_averages (weekday, average_hours, company_id) 
            VALUES (?, ?, ?) 
            ON CONFLICT(weekday, company_id) 
            DO UPDATE SET average_hours = excluded.average_hours`,
      args: [weekday, averageHours, companyId]
    });
  }

  async fillWithAverages(startDate: string, endDate: string, companyId: number): Promise<void> {
    const averages = await this.getWeekdayAverages(companyId);
    if (averages.length === 0) return;

    const averageMap = new Map(averages.map(avg => [avg.weekday, avg.average_hours]));
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const weekday = date.getDay();
      const averageHours = averageMap.get(weekday);
      
      if (averageHours) {
        const dateString = date.toISOString().split('T')[0];
        
        // Check if entry already exists
        const existingResult = await this.client.execute({
          sql: 'SELECT id FROM hour_entries WHERE date = ? AND company_id = ?',
          args: [dateString, companyId]
        });
        
        if (existingResult.rows.length === 0) {
          await this.addEntry(dateString, averageHours, 'Filled with average', companyId);
        }
      }
    }
  }

  // Legacy settings methods (kept for compatibility)
  async getSettings(): Promise<Settings> {
    // Return default settings since we now use company-based rates
    return { hourly_rate: 0 };
  }

  async updateSettings(): Promise<void> {
    // No-op since we now use company-based rates
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