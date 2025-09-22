import { createClient } from '@libsql/client';

const client = createClient({
  url: 'file:data/hours.db'
});

async function migrateDatabase() {
  try {
    console.log('🔄 Iniciando migración de base de datos...');

    // Verificar si ya existe la columna company_id
    const result = await client.execute("PRAGMA table_info(hour_entries)");
    const hasCompanyId = result.rows.some(row => row.name === 'company_id');
    
    if (!hasCompanyId) {
      console.log('➕ Añadiendo columna company_id a hour_entries...');
      
      // Crear tabla temporal con nuevo esquema
      await client.execute(`
        CREATE TABLE hour_entries_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          hours REAL NOT NULL,
          description TEXT,
          company_id INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Copiar datos existentes asignando company_id = 1
      await client.execute(`
        INSERT INTO hour_entries_new (id, date, hours, description, company_id, created_at)
        SELECT id, date, hours, description, 1, created_at 
        FROM hour_entries
      `);
      
      // Eliminar tabla antigua
      await client.execute('DROP TABLE hour_entries');
      
      // Renombrar tabla nueva
      await client.execute('ALTER TABLE hour_entries_new RENAME TO hour_entries');
      
      console.log('✅ Migración de hour_entries completada');
    } else {
      console.log('ℹ️  La columna company_id ya existe en hour_entries');
    }

    // Verificar si weekday_averages necesita migración
    const weekdayResult = await client.execute("PRAGMA table_info(weekday_averages)");
    const weekdayHasCompanyId = weekdayResult.rows.some(row => row.name === 'company_id');
    
    if (!weekdayHasCompanyId && weekdayResult.rows.length > 0) {
      console.log('➕ Añadiendo columna company_id a weekday_averages...');
      
      await client.execute(`
        CREATE TABLE weekday_averages_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          weekday INTEGER NOT NULL,
          average_hours REAL NOT NULL,
          company_id INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(weekday, company_id)
        )
      `);
      
      await client.execute(`
        INSERT INTO weekday_averages_new (id, weekday, average_hours, company_id, created_at)
        SELECT id, weekday, average, 1, created_at 
        FROM weekday_averages
      `);
      
      await client.execute('DROP TABLE weekday_averages');
      await client.execute('ALTER TABLE weekday_averages_new RENAME TO weekday_averages');
      
      console.log('✅ Migración de weekday_averages completada');
    }

    console.log('🎉 Migración completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await client.close();
  }
}

migrateDatabase();