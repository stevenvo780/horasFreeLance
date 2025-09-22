# 🕒 Horas FreeLance - Tracker de Horas con Analytics

Una aplicación moderna de Next.js para el seguimiento inteligente de horas de trabajo freelance con análisis avanzados y formato colombiano.

## ✨ Características

### 📊 Dashboard Analítico
- **Tendencias Inteligentes**: Comparaciones automáticas semanales y mensuales
- **Indicadores Visuales**: Flechas de tendencia para identificar patrones
- **Alertas Proactivas**: Detección de días faltantes y productividad baja
- **Análisis de Patrones**: Visualización de productividad por día de la semana

### 🛠️ Gestión CRUD Completa
- **Tabla Interactiva**: Paginación, filtros por fecha, edición inline
- **Modos Duales**: Vista de lista y asignación masiva
- **Operaciones Masivas**: Agregar múltiples registros por rango de fechas
- **Validación Robusta**: Prevención de duplicados y validación de datos

### 🇨🇴 Localización Colombiana
- **Formato de Moneda**: $50.000,00 (punto de miles, coma decimal)
- **Formato de Horas**: 8,5 horas (coma decimal)
- **Interfaz en Español**: Completamente traducida

### ☁️ Base de Datos en la Nube
- **Turso SQLite**: Base de datos serverless de alta performance
- **Sincronización Global**: Acceso rápido desde cualquier ubicación
- **Backup Automático**: Datos seguros y siempre disponibles

## 🚀 Tecnologías

- **Frontend**: Next.js 15.5.3, React 19, TypeScript
- **Estilos**: Tailwind CSS 4
- **Base de Datos**: Turso (LibSQL)
- **Iconografía**: Lucide React
- **Despliegue**: Vercel

## 📦 Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/stevenvo780/horasFreeLance.git
cd horasFreeLance
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
# .env.local
TURSO_DATABASE_URL=your_turso_database_url
TURSO_AUTH_TOKEN=your_turso_auth_token
```

4. **Ejecutar en desarrollo**
```bash
npm run dev
```

5. **Acceder a la aplicación**
```
http://localhost:3000
```

## 🔧 Scripts

- `npm run dev` - Servidor de desarrollo con Turbopack
- `npm run build` - Build de producción
- `npm run start` - Servidor de producción
- `npm run lint` - Linter ESLint

## 📱 Uso

### Dashboard Principal
- **Resumen Ejecutivo**: Total de horas, días registrados, ingresos
- **Análisis de Tendencias**: Comparación de períodos con indicadores visuales
- **Alertas Inteligentes**: Notificaciones sobre patrones de trabajo
- **Configuración Rápida**: Actualización de tarifa por hora

### Gestión de Registros
- **Agregar Entradas**: Formulario simple para registros individuales
- **Edición Inline**: Modificar registros directamente en la tabla
- **Filtros Avanzados**: Por rango de fechas y paginación
- **Asignación Masiva**: Llenar múltiples fechas automáticamente

## 🎯 Análisis Disponibles

- **Comparación Semanal**: Esta semana vs semana anterior
- **Comparación Mensual**: Este mes vs mes anterior
- **Productividad Diaria**: Promedio de horas por día de la semana
- **Detección de Patrones**: Identificación automática de tendencias
- **Cálculo de Ingresos**: En tiempo real con formato colombiano

## 🔐 Seguridad

- Variables de entorno para credenciales sensibles
- Validación de datos en frontend y backend
- Conexión segura con Turso via LibSQL

## 📈 Performance

- **Turbopack**: Build ultrarrápido en desarrollo
- **Edge Database**: Latencia mínima con Turso
- **Optimización React**: Componentes eficientes y memoizados
- **SSR**: Renderizado del lado del servidor para SEO

## 🌐 Despliegue en Vercel

1. **Conectar repositorio** a tu cuenta de Vercel
2. **Configurar variables de entorno**:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
3. **Desplegar** automáticamente desde `main`

## 🤝 Contribución

1. Fork del proyecto
2. Crear branch de feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto es de uso privado.

## 👨‍💻 Autor

**Steven VO** - [@stevenvo780](https://github.com/stevenvo780)

---

⭐ Si te gusta este proyecto, ¡dale una estrella!