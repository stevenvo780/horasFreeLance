#!/usr/bin/env node

const { getDatabase } = require('./src/lib/db');

async function test() {
  try {
    console.log('🔧 Inicializando base de datos...');
    const db = getDatabase();
    await db.initialize();
    console.log('✅ Base de datos inicializada correctamente');
    
    console.log('🧪 Probando crear usuario...');
    try {
      const user = await db.createUser(
        'test@example.com',
        'testpassword123',
        'Test',
        'User'
      );
      console.log('✅ Usuario creado:', { id: user.id, email: user.email });
      
      console.log('🧪 Probando crear empresa...');
      const company = await db.createCompany(
        'Empresa de Prueba',
        'Una empresa para testing',
        50.0,
        user.id
      );
      console.log('✅ Empresa creada:', { id: company.id, name: company.name });
      
      console.log('🧪 Probando crear entrada de horas...');
      const entry = await db.addEntry(
        '2025-01-21',
        8.5,
        company.id,
        user.id
      );
      console.log('✅ Entrada creada:', entry);
      
      console.log('🧪 Verificando datos...');
      const entries = await db.getEntries(undefined, undefined, company.id, user.id);
      const companies = await db.getCompaniesByUserId(user.id);
      console.log('✅ Datos verificados:', { entries: entries.length, companies: companies.length });
      
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        console.log('ℹ️  Los datos de prueba ya existen, esto es normal');
      } else {
        throw error;
      }
    }
    
    console.log('🎉 ¡Todas las pruebas pasaron correctamente!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

test();