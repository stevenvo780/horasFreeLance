#!/bin/bash

echo "=== Probando el sistema de autenticación y empresas ==="

# URL base
BASE_URL="http://localhost:3000"

echo ""
echo "1. Probando registro de usuario..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Usuario Test"
  }')

echo "Respuesta del registro: $REGISTER_RESPONSE"

echo ""
echo "2. Probando login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }')

echo "Respuesta del login: $LOGIN_RESPONSE"

# Extraer token del login
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo "Token obtenido: $TOKEN"
  
  echo ""
  echo "3. Creando empresa..."
  COMPANY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/companies" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
      "name": "Mi Empresa Test",
      "hourly_rate": 50.0
    }')
  
  echo "Respuesta de crear empresa: $COMPANY_RESPONSE"
  
  echo ""
  echo "4. Obteniendo empresas del usuario..."
  COMPANIES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/companies" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "Empresas del usuario: $COMPANIES_RESPONSE"
  
  echo ""
  echo "5. Verificando status general..."
  STATUS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/status" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "Status: $STATUS_RESPONSE"
  
else
  echo "No se pudo obtener el token. Verificar credenciales."
fi

echo ""
echo "=== Prueba completada ==="