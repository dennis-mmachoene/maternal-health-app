#!/usr/bin/env bash
# ============================================================
# MaternaML — Local Development Setup Script
# ============================================================
set -e

BOLD=$(tput bold 2>/dev/null || echo "")
RESET=$(tput sgr0 2>/dev/null || echo "")
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${BLUE}▶${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }

echo ""
echo "${BOLD}  MaternaML — Maternal Health Risk Intelligence${RESET}"
echo "  Full-Stack ML Application Setup"
echo "  ─────────────────────────────────────────────"
echo ""

# ─── Check Prerequisites ──────────────────────────────────────────────────────
log "Checking prerequisites…"

command -v python3 >/dev/null 2>&1 || err "Python 3 not found. Install from https://python.org"
command -v node >/dev/null 2>&1    || err "Node.js not found. Install from https://nodejs.org"
command -v psql >/dev/null 2>&1    || warn "PostgreSQL CLI not found — make sure your DB is running"
ok "Prerequisites checked"

# ─── Dataset ──────────────────────────────────────────────────────────────────
log "Checking dataset…"
DATASET_SRC="Maternal_Health_Risk_Data_Set.csv"
DATASET_DST="backend/data/Maternal_Health_Risk_Data_Set.csv"

if [ -f "$DATASET_SRC" ]; then
  cp "$DATASET_SRC" "$DATASET_DST"
  ok "Dataset copied to backend/data/"
elif [ -f "$DATASET_DST" ]; then
  ok "Dataset already in place"
else
  warn "Dataset not found. Please place Maternal_Health_Risk_Data_Set.csv in the project root."
fi

# ─── Backend ──────────────────────────────────────────────────────────────────
log "Setting up backend…"
cd backend

# Create virtualenv
if [ ! -d "venv" ]; then
  python3 -m venv venv
  ok "Created Python virtual environment"
fi

# Activate and install
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
ok "Python dependencies installed"

# Create directories
mkdir -p logs ml/models data staticfiles
ok "Directories created"

# Database setup
log "Setting up PostgreSQL database…"
export PGPASSWORD=postgres
psql -U postgres -h localhost -tc "SELECT 1 FROM pg_database WHERE datname='maternal_health_db'" \
  | grep -q 1 \
  || psql -U postgres -h localhost -c "CREATE DATABASE maternal_health_db;" 2>/dev/null \
  && ok "Database created" || warn "Could not create DB — may already exist or check credentials"

# Migrations
python manage.py migrate --noinput 2>/dev/null && ok "Migrations applied" || warn "Migrations failed — check DB connection"

# Static files
python manage.py collectstatic --noinput -v 0 2>/dev/null && ok "Static files collected"

cd ..

# ─── Frontend ─────────────────────────────────────────────────────────────────
log "Setting up frontend…"
cd frontend
npm install --silent
ok "Node dependencies installed"
cd ..

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "  ${GREEN}${BOLD}Setup complete!${RESET}"
echo ""
echo "  ${BOLD}Start the application:${RESET}"
echo ""
echo "  1. Backend (terminal 1):"
echo "     ${BLUE}cd backend && source venv/bin/activate && python manage.py runserver${NC}"
echo ""
echo "  2. Frontend (terminal 2):"
echo "     ${BLUE}cd frontend && npm run dev${NC}"
echo ""
echo "  3. Open: ${BLUE}http://localhost:5173${NC}"
echo ""
echo "  ${BOLD}Workflow:${RESET}"
echo "  a. Visit Overview → click 'Ingest to DB'"
echo "  b. Visit Model Training → click 'Start Training'"
echo "  c. Explore EDA, Performance, and Prediction pages"
echo ""
