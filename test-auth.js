import { Database } from './src/lib/db.js';

async function testAuth() {
  const db = new Database();
  
  try {
    console.log('Inicializando base de datos...');
    await db.init();
    
    console.log('Creando usuario de prueba...');
    const userId = await db.createUser('test@example.com', 'hashedpassword123', 'Test User');
    console.log('Usuario creado con ID:', userId);
    
    console.log('Creando empresa de prueba...');
    const companyId = await db.createCompany('Empresa Test', 50.0, userId);
    console.log('Empresa creada con ID:', companyId);
    
    console.log('Obteniendo empresas del usuario...');
    const companies = await db.getUserCompanies(userId);
    console.log('Empresas encontradas:', companies);
    
    console.log('Verificando usuario...');
    const user = await db.getUserByEmail('test@example.com');
    console.log('Usuario encontrado:', user);
    
    console.log('✅ Todas las pruebas pasaron correctamente!');
    
  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  } finally {
    await db.close();
  }
}

testAuth();