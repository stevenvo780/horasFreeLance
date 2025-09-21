#!/bin/bash

echo "🚀 Probando la aplicación Next.js de Hours Tracker..."
echo

# Función para hacer peticiones con manejo de errores
make_request() {
    local method=$1
    local url=$2
    local data=$3
    
    echo "📡 $method $url"
    if [ -n "$data" ]; then
        echo "   Data: $data"
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$url" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
    fi
    
    # Separar body y status code
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        echo "   ✅ Status: $http_code"
        echo "   Response: $(echo "$body" | jq -r '.status // .message // .' 2>/dev/null || echo "$body")"
    else
        echo "   ❌ Status: $http_code"
        echo "   Response: $body"
    fi
    echo
}

# Verificar que el servidor esté corriendo
echo "🔍 Verificando servidor..."
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "❌ El servidor no está corriendo en http://localhost:3000"
    echo "   Ejecuta: npm run dev en el directorio nextjs-hours-tracker"
    exit 1
fi
echo "✅ Servidor corriendo correctamente"
echo

# Probar endpoints
echo "🧪 Probando APIs..."

# 1. Status inicial
make_request "GET" "http://localhost:3000/api/status"

# 2. Configurar tarifa
make_request "POST" "http://localhost:3000/api/settings/rate" '{"rate": 45.50}'

# 3. Agregar una entrada
today=$(date +%Y-%m-%d)
make_request "POST" "http://localhost:3000/api/entries" "{\"date\": \"$today\", \"hours\": 8.5}"

# 4. Agregar más entradas para promedios
yesterday=$(date -d "yesterday" +%Y-%m-%d)
make_request "POST" "http://localhost:3000/api/entries" "{\"date\": \"$yesterday\", \"hours\": 7.5}"

# 5. Obtener promedios por día
make_request "GET" "http://localhost:3000/api/weekday-averages"

# 6. Agregar entradas en bulk
start_date=$(date -d "3 days ago" +%Y-%m-%d)
end_date=$(date -d "1 day ago" +%Y-%m-%d)
make_request "POST" "http://localhost:3000/api/entries/bulk" "{
    \"start_date\": \"$start_date\",
    \"end_date\": \"$end_date\",
    \"hours\": 6.0,
    \"weekdays\": [\"lunes\", \"martes\", \"miércoles\"],
    \"mode\": \"set\",
    \"skip_existing\": true
}"

# 7. Status final
make_request "GET" "http://localhost:3000/api/status"

echo "🎉 ¡Prueba completada!"
echo "💻 Abre http://localhost:3000 en tu navegador para usar la interfaz web"