# Hours Tracker - Next.js

Una aplicación moderna de tracking de horas freelance refactorizada de Python a Next.js con SQLite.

## Características

- 📊 **Dashboard interactivo** con estadísticas en tiempo real
- 🕒 **Registro de horas** individual y masivo
- 🧹 **Acciones en lote** para editar o eliminar varios registros a la vez
- 💰 **Configuración de tarifa** y cálculo de ingresos
- 📅 **Filtros por días** de la semana para entradas masivas
- 🔄 **Llenado automático** con promedios por día de la semana
- 🗃️ **Base de datos SQLite** local y persistente
- 🎨 **Interfaz moderna** con Tailwind CSS
- ⚡ **API REST** completa con Next.js

## Tecnologías

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, SQLite3
- **Icons**: Lucide React
- **Base de datos**: SQLite con triggers automáticos

## Instalación

```bash
# Clonar repositorio
cd nextjs-hours-tracker

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev
```

## Variables de entorno

- Copia `.env.example` a `.env.local` y ajusta los valores para tu entorno.
- Define siempre `JWT_SECRET` en producción. Si falta en desarrollo se generará uno temporal y los usuarios serán desconectados al reiniciar el servidor.
- Revisa `ALLOW_INSECURE_AUTH_COOKIE` y `RATE_LIMIT_TRUST_FORWARD_HEADER` solo si necesitas modificar el comportamiento por defecto.

## Uso

1. **Configurar tarifa**: Establece tu tarifa por hora en la sección "Configurar Tarifa"
2. **Registrar horas**: Usa el formulario "Registrar Horas" para días individuales
3. **Agregar rangos**: Usa "Agregar Rango de Fechas" para múltiples días con filtros
4. **Llenar huecos**: Usa "Llenar con Promedios" para completar fechas faltantes
5. **Ver estadísticas**: El dashboard muestra totales, promedios e ingresos estimados

## API Endpoints

- `GET /api/status` - Estado completo de la aplicación
- `POST /api/entries` - Agregar entrada individual
- `POST /api/entries/bulk` - Agregar múltiples entradas
- `POST /api/entries/fill-average` - Llenar con promedios
- `POST /api/settings/rate` - Configurar tarifa por hora
- `GET /api/weekday-averages` - Obtener promedios por día

## Estructura de la Base de Datos

### hour_entries
- `id` (INTEGER PRIMARY KEY)
- `date` (TEXT UNIQUE) - Formato YYYY-MM-DD
- `hours` (REAL) - Horas trabajadas
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

### settings
- `id` (INTEGER PRIMARY KEY)
- `hourly_rate` (REAL) - Tarifa por hora
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

## Migración desde Python

Esta aplicación es una refactorización completa de la utilidad Python original, manteniendo toda la funcionalidad:

- ✅ Todas las operaciones CRUD migradas
- ✅ Lógica de promedios por día de la semana
- ✅ Operaciones bulk con filtros de weekdays
- ✅ Cálculos de ingresos estimados
- ✅ Interfaz mejorada y más intuitiva

## Desarrollo

```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Build para producción
npm run build

# Ejecutar producción
npm start

# Linting
npm run lint
```

## Estructura del Proyecto

```
src/
├── app/
│   ├── api/          # API Routes
│   │   ├── status/
│   │   ├── entries/
│   │   ├── settings/
│   │   └── weekday-averages/
│   ├── globals.css   # Estilos globales
│   ├── layout.tsx    # Layout principal
│   └── page.tsx      # Página principal
├── lib/
│   ├── db.ts         # Lógica de base de datos
│   └── types.ts      # Tipos TypeScript
data/
└── hours.db          # Base de datos SQLite (generada automáticamente)
```

La base de datos se crea automáticamente en la primera ejecución en `./data/hours.db`.
