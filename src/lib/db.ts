import { createClient, type ResultSet } from '@libsql/client';
import { HourEntry, Settings, WeekdayAverage, User, Company, Project, EntryChange, UserBillingInfo, CompanyBillingInfo, Invoice, InvoiceItem, InvoiceStatus } from './types';

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

      // Create user_billing_info table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS user_billing_info (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE,
          name TEXT NOT NULL,
          id_type TEXT NOT NULL DEFAULT 'C.C.',
          id_number TEXT NOT NULL,
          address TEXT,
          city TEXT,
          phone TEXT,
          bank_name TEXT,
          account_type TEXT,
          account_number TEXT,
          signature_image TEXT,
          declaration TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create company_billing_info table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS company_billing_info (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL UNIQUE,
          legal_name TEXT,
          nit TEXT,
          address TEXT,
          city TEXT,
          contact_name TEXT,
          contact_phone TEXT,
          contact_email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE
        )
      `);

      // Create invoices table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS invoices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          company_id INTEGER NOT NULL,
          number TEXT NOT NULL,
          issue_date TEXT NOT NULL,
          period_start TEXT NOT NULL,
          period_end TEXT NOT NULL,
          project_name TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          issuer_name TEXT NOT NULL,
          issuer_id_type TEXT NOT NULL,
          issuer_id_number TEXT NOT NULL,
          issuer_address TEXT,
          issuer_city TEXT,
          issuer_phone TEXT,
          issuer_bank_name TEXT,
          issuer_account_type TEXT,
          issuer_account_number TEXT,
          issuer_signature_image TEXT,
          issuer_declaration TEXT,
          client_name TEXT NOT NULL,
          client_nit TEXT,
          client_address TEXT,
          client_city TEXT,
          total_hours REAL NOT NULL DEFAULT 0,
          total_amount REAL NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE CASCADE,
          UNIQUE(user_id, number)
        )
      `);

      // Create invoice_items table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS invoice_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          invoice_id INTEGER NOT NULL,
          concept TEXT NOT NULL,
          hours REAL NOT NULL,
          rate REAL NOT NULL,
          total REAL NOT NULL,
          project_id INTEGER,
          FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE SET NULL
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

  async getEntriesByDateRange(companyId: number, startDate: string, endDate: string): Promise<HourEntry[]> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM hour_entries WHERE company_id = ? AND date >= ? AND date <= ? ORDER BY date ASC, id ASC',
      args: [companyId, startDate, endDate]
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

  // ========== User Billing Info Methods ==========

  async getUserBillingInfo(userId: number): Promise<UserBillingInfo | null> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM user_billing_info WHERE user_id = ?',
      args: [userId]
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: Number(row.id),
      user_id: Number(row.user_id),
      name: String(row.name ?? ''),
      id_type: String(row.id_type ?? 'C.C.'),
      id_number: String(row.id_number ?? ''),
      address: row.address ? String(row.address) : undefined,
      city: row.city ? String(row.city) : undefined,
      phone: row.phone ? String(row.phone) : undefined,
      bank_name: row.bank_name ? String(row.bank_name) : undefined,
      account_type: row.account_type ? String(row.account_type) : undefined,
      account_number: row.account_number ? String(row.account_number) : undefined,
      signature_image: row.signature_image ? String(row.signature_image) : undefined,
      declaration: row.declaration ? String(row.declaration) : undefined,
      created_at: row.created_at ? String(row.created_at) : undefined,
      updated_at: row.updated_at ? String(row.updated_at) : undefined
    };
  }

  async upsertUserBillingInfo(userId: number, info: Omit<UserBillingInfo, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<number> {
    const client = this.getClient();
    const result = await client.execute({
      sql: `INSERT INTO user_billing_info (user_id, name, id_type, id_number, address, city, phone, bank_name, account_type, account_number, signature_image, declaration, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              name = excluded.name,
              id_type = excluded.id_type,
              id_number = excluded.id_number,
              address = excluded.address,
              city = excluded.city,
              phone = excluded.phone,
              bank_name = excluded.bank_name,
              account_type = excluded.account_type,
              account_number = excluded.account_number,
              signature_image = excluded.signature_image,
              declaration = excluded.declaration,
              updated_at = CURRENT_TIMESTAMP`,
      args: [
        userId,
        info.name,
        info.id_type,
        info.id_number,
        info.address ?? null,
        info.city ?? null,
        info.phone ?? null,
        info.bank_name ?? null,
        info.account_type ?? null,
        info.account_number ?? null,
        info.signature_image ?? null,
        info.declaration ?? null
      ]
    });
    return Number(result.lastInsertRowid);
  }

  // ========== Company Billing Info Methods ==========

  async getCompanyBillingInfo(companyId: number): Promise<CompanyBillingInfo | null> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM company_billing_info WHERE company_id = ?',
      args: [companyId]
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    return {
      id: Number(row.id),
      company_id: Number(row.company_id),
      legal_name: row.legal_name ? String(row.legal_name) : undefined,
      nit: row.nit ? String(row.nit) : undefined,
      address: row.address ? String(row.address) : undefined,
      city: row.city ? String(row.city) : undefined,
      contact_name: row.contact_name ? String(row.contact_name) : undefined,
      contact_phone: row.contact_phone ? String(row.contact_phone) : undefined,
      contact_email: row.contact_email ? String(row.contact_email) : undefined,
      created_at: row.created_at ? String(row.created_at) : undefined,
      updated_at: row.updated_at ? String(row.updated_at) : undefined
    };
  }

  async upsertCompanyBillingInfo(companyId: number, info: Omit<CompanyBillingInfo, 'id' | 'company_id' | 'created_at' | 'updated_at'>): Promise<number> {
    const client = this.getClient();
    const result = await client.execute({
      sql: `INSERT INTO company_billing_info (company_id, legal_name, nit, address, city, contact_name, contact_phone, contact_email, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(company_id) DO UPDATE SET
              legal_name = excluded.legal_name,
              nit = excluded.nit,
              address = excluded.address,
              city = excluded.city,
              contact_name = excluded.contact_name,
              contact_phone = excluded.contact_phone,
              contact_email = excluded.contact_email,
              updated_at = CURRENT_TIMESTAMP`,
      args: [
        companyId,
        info.legal_name ?? null,
        info.nit ?? null,
        info.address ?? null,
        info.city ?? null,
        info.contact_name ?? null,
        info.contact_phone ?? null,
        info.contact_email ?? null
      ]
    });
    return Number(result.lastInsertRowid);
  }

  // ========== Invoice Methods ==========

  async getNextInvoiceNumber(userId: number): Promise<string> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT MAX(CAST(number AS INTEGER)) as max_num FROM invoices WHERE user_id = ?',
      args: [userId]
    });
    
    const maxNum = result.rows[0]?.max_num;
    const nextNum = (maxNum ? Number(maxNum) : 0) + 1;
    return nextNum.toString().padStart(3, '0');
  }

  async createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const client = this.getClient();
    const result = await client.execute({
      sql: `INSERT INTO invoices (
              user_id, company_id, number, issue_date, period_start, period_end, project_name, status,
              issuer_name, issuer_id_type, issuer_id_number, issuer_address, issuer_city, issuer_phone,
              issuer_bank_name, issuer_account_type, issuer_account_number, issuer_signature_image, issuer_declaration,
              client_name, client_nit, client_address, client_city,
              total_hours, total_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        invoice.user_id,
        invoice.company_id,
        invoice.number,
        invoice.issue_date,
        invoice.period_start,
        invoice.period_end,
        invoice.project_name ?? null,
        invoice.status,
        invoice.issuer_name,
        invoice.issuer_id_type,
        invoice.issuer_id_number,
        invoice.issuer_address ?? null,
        invoice.issuer_city ?? null,
        invoice.issuer_phone ?? null,
        invoice.issuer_bank_name ?? null,
        invoice.issuer_account_type ?? null,
        invoice.issuer_account_number ?? null,
        invoice.issuer_signature_image ?? null,
        invoice.issuer_declaration ?? null,
        invoice.client_name,
        invoice.client_nit ?? null,
        invoice.client_address ?? null,
        invoice.client_city ?? null,
        invoice.total_hours,
        invoice.total_amount
      ]
    });
    return Number(result.lastInsertRowid);
  }

  async addInvoiceItem(item: Omit<InvoiceItem, 'id'>): Promise<number> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'INSERT INTO invoice_items (invoice_id, concept, hours, rate, total, project_id) VALUES (?, ?, ?, ?, ?, ?)',
      args: [item.invoice_id, item.concept, item.hours, item.rate, item.total, item.project_id ?? null]
    });
    return Number(result.lastInsertRowid);
  }

  async getInvoiceById(id: number): Promise<Invoice | null> {
    const client = this.getClient();
    const result = await client.execute({
      sql: 'SELECT * FROM invoices WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    const invoice = this.mapRowToInvoice(row);

    // Get items
    const itemsResult = await client.execute({
      sql: 'SELECT * FROM invoice_items WHERE invoice_id = ?',
      args: [id]
    });

    invoice.items = itemsResult.rows.map((itemRow: Record<string, unknown>) => ({
      id: Number(itemRow.id),
      invoice_id: Number(itemRow.invoice_id),
      concept: String(itemRow.concept),
      hours: Number(itemRow.hours),
      rate: Number(itemRow.rate),
      total: Number(itemRow.total),
      project_id: itemRow.project_id != null ? Number(itemRow.project_id) : null
    }));

    return invoice;
  }

  async getUserInvoices(userId: number, companyId?: number): Promise<Invoice[]> {
    const client = this.getClient();
    let sql = 'SELECT * FROM invoices WHERE user_id = ?';
    const args: (number | string)[] = [userId];

    if (companyId) {
      sql += ' AND company_id = ?';
      args.push(companyId);
    }

    sql += ' ORDER BY created_at DESC';

    const result = await client.execute({ sql, args });
    return result.rows.map((row: Record<string, unknown>) => this.mapRowToInvoice(row));
  }

  async updateInvoiceStatus(id: number, status: InvoiceStatus): Promise<void> {
    const client = this.getClient();
    await client.execute({
      sql: 'UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [status, id]
    });
  }

  async deleteInvoice(id: number): Promise<void> {
    const client = this.getClient();
    // Items se eliminan automáticamente por CASCADE
    await client.execute({
      sql: 'DELETE FROM invoices WHERE id = ?',
      args: [id]
    });
  }

  private mapRowToInvoice(row: Record<string, unknown>): Invoice {
    return {
      id: Number(row.id),
      user_id: Number(row.user_id),
      company_id: Number(row.company_id),
      number: String(row.number),
      issue_date: String(row.issue_date),
      period_start: String(row.period_start),
      period_end: String(row.period_end),
      project_name: row.project_name ? String(row.project_name) : undefined,
      status: String(row.status) as InvoiceStatus,
      issuer_name: String(row.issuer_name),
      issuer_id_type: String(row.issuer_id_type),
      issuer_id_number: String(row.issuer_id_number),
      issuer_address: row.issuer_address ? String(row.issuer_address) : undefined,
      issuer_city: row.issuer_city ? String(row.issuer_city) : undefined,
      issuer_phone: row.issuer_phone ? String(row.issuer_phone) : undefined,
      issuer_bank_name: row.issuer_bank_name ? String(row.issuer_bank_name) : undefined,
      issuer_account_type: row.issuer_account_type ? String(row.issuer_account_type) : undefined,
      issuer_account_number: row.issuer_account_number ? String(row.issuer_account_number) : undefined,
      issuer_signature_image: row.issuer_signature_image ? String(row.issuer_signature_image) : undefined,
      issuer_declaration: row.issuer_declaration ? String(row.issuer_declaration) : undefined,
      client_name: String(row.client_name),
      client_nit: row.client_nit ? String(row.client_nit) : undefined,
      client_address: row.client_address ? String(row.client_address) : undefined,
      client_city: row.client_city ? String(row.client_city) : undefined,
      total_hours: Number(row.total_hours),
      total_amount: Number(row.total_amount),
      created_at: row.created_at ? String(row.created_at) : undefined,
      updated_at: row.updated_at ? String(row.updated_at) : undefined
    };
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