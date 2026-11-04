#!/usr/bin/env bash
# Prueba la migración y las reglas de seguridad en un Postgres vacío.
# Uso: PGURL=postgres://usuario:clave@localhost:5432/postgres bash supabase/tests/ejecutar.sh
set -euo pipefail
: "${PGURL:?Falta PGURL (conexión a un Postgres de PRUEBAS, nunca al de Supabase)}"
cd "$(dirname "$0")/../.."
BD=crm_pruebas_$$
psql "$PGURL" -v ON_ERROR_STOP=1 -q -c "create database $BD"
URL_BD="${PGURL%/*}/$BD"
limpiar() { psql "$PGURL" -q -c "drop database if exists $BD" >/dev/null 2>&1 || true; }
trap limpiar EXIT
psql "$URL_BD" -v ON_ERROR_STOP=1 -q -f supabase/tests/00_simular_supabase.sql
for f in supabase/migrations/*.sql; do psql "$URL_BD" -v ON_ERROR_STOP=1 -q -f "$f"; done
psql "$URL_BD" -v ON_ERROR_STOP=1 -q -t -f supabase/tests/01_seguridad.sql | grep -E "PASAN" || { echo "Las pruebas SQL han fallado"; exit 1; }
