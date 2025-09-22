# 🚀 Guía de Despliegue en Vercel

## ⚠️ PROBLEMA ACTUAL - ERROR 405

La aplicación actualmente falla en producción con error 405 en las APIs. Esto se debe a que **faltan las variables de entorno** necesarias para la base de datos.

## Paso 1: Configurar Variables de Entorno en Vercel

**URGENTE**: Necesitas configurar estas variables en Vercel:

### Variables Requeridas:

```bash
JWT_SECRET=tu-clave-secreta-jwt-super-segura-2024
TURSO_DATABASE_URL=libsql://tu-database.turso.io  
TURSO_AUTH_TOKEN=tu-token-de-turso
```

### Cómo configurarlas:

1. Ve a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto "horas-freelance"  
3. Ve a **Settings** → **Environment Variables**
4. Agrega cada variable:
   - **Name**: `JWT_SECRET`
   - **Value**: una clave aleatoria segura
   - **Environment**: Production, Preview, Development
5. Repite para `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`

## Paso 2: Configurar Base de Datos Turso

Si no tienes Turso configurado:

1. Ve a [turso.tech](https://turso.tech)
2. Crea cuenta gratuita
3. Crea una nueva database
4. Copia la URL y Auth Token  
5. Agrega estos valores a Vercel

### Variables requeridas:
```
TURSO_DATABASE_URL = libsql://horas-stev.aws-us-east-2.turso.io
```

```
TURSO_AUTH_TOKEN = eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTg1MDU2NDIsImlkIjoiODYxMmI2OTctZmRiMy00NTIzLWFhNWQtNmNiM2JiYTBkODI3IiwicmlkIjoiYTA5NGI3N2MtYjUyNy00ZjJkLWEwZWEtZmZhOTIzNTY0ZWI3In0.LRpzgwJe4I8oUHbCsDpwOJXNVs_G-CTAEUlBhW8LxUZ4bz5KyHWt5GYMTng3pmkjx7w76yElDJLqZC_c9T8BDg
```

## Paso 4: Configuración del proyecto

- **Framework Preset**: Next.js (se detecta automáticamente)
- **Root Directory**: `.` (raíz del proyecto)
- **Build Command**: `npm run build` (automático)
- **Output Directory**: `.next` (automático)
- **Install Command**: `npm install` (automático)

## Paso 5: Desplegar

1. Haz clic en **"Deploy"**
2. Vercel comenzará el proceso de build y despliegue
3. ⏱️ El proceso toma aproximadamente 2-3 minutos

## ✅ Verificación del despliegue

Una vez completado el despliegue:

1. **URL de producción**: Vercel te proporcionará una URL como `https://horas-freelance-stevenvo780.vercel.app`
2. **Verificar funcionalidad**:
   - ✅ Dashboard con analytics debe cargar
   - ✅ Tabla de registros debe mostrar los 44 registros migrados
   - ✅ Agregar nuevos registros debe funcionar
   - ✅ Edición y eliminación debe funcionar
   - ✅ Formato colombiano debe mostrarse correctamente

## 🔧 Configuración automática

Vercel configurará automáticamente:

- ✅ **HTTPS**: SSL automático
- ✅ **CDN Global**: Distribución mundial
- ✅ **Edge Functions**: APIs serverless
- ✅ **Domain**: Subdominio automático
- ✅ **Git Integration**: Deploy automático en push

## 📊 Datos de prueba incluidos

Tu aplicación desplegada incluirá:

- **43 registros** migrados desde SQLite local
- **Tarifa configurada**: $50.000/hora
- **Total de horas**: 325.5 horas
- **Ingresos calculados**: $16.275.000
- **Analytics funcionales**: Comparaciones semanales y mensuales

## 🎯 Próximos pasos después del despliegue

1. **Probar todas las funcionalidades** en producción
2. **Configurar dominio personalizado** (opcional)
3. **Monitorear performance** en el dashboard de Vercel
4. **Configurar alertas** si necesario

## 🆘 Solución de problemas

### Error de build:
- Verificar que las variables de entorno estén configuradas
- Revisar logs de build en Vercel dashboard

### Error de conexión a base de datos:
- Verificar TURSO_DATABASE_URL
- Verificar TURSO_AUTH_TOKEN
- Verificar que Turso esté activo

### Error 500:
- Revisar Function Logs en Vercel dashboard
- Verificar que todas las dependencias estén en package.json

## 📱 URL final esperada

Una vez desplegado, tu aplicación estará disponible en:
`https://horas-freelance-[hash].vercel.app`

¡Listo para usar en producción! 🎉