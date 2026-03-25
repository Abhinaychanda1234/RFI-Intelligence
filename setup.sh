#!/bin/bash
# ============================================================
# RFI Genie v2.0 — One-click setup script
# Run: chmod +x setup.sh && ./setup.sh
# ============================================================
set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${BLUE}ℹ  $1${NC}"; }
warn() { echo -e "${YELLOW}⚠  $1${NC}"; }

echo -e "\n╔══════════════════════════════════════╗"
echo -e "║   RFI Genie v2.0 — Setup            ║"
echo -e "╚══════════════════════════════════════╝\n"

# Check Node
command -v node >/dev/null || { echo "❌ Node.js not installed. Visit https://nodejs.org"; exit 1; }
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
[ "$NODE_VER" -lt 18 ] && { echo "❌ Node.js 18+ required (you have $(node -v))"; exit 1; }
ok "Node.js $(node -v)"

# Install frontend deps
info "Installing frontend dependencies..."
npm install
ok "Frontend dependencies installed"

# Install backend deps
info "Installing backend dependencies..."
cd backend && npm install && cd ..
ok "Backend dependencies installed"

# Create .env if missing
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  warn "Created backend/.env — PLEASE ADD YOUR OPENAI_API_KEY!"
  warn "Edit: backend/.env → set OPENAI_API_KEY=sk-..."
else
  ok "backend/.env exists"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Setup Complete!                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit backend/.env → add your OPENAI_API_KEY"
echo "  2. Terminal 1: cd backend && npm run dev"
echo "  3. Terminal 2: npm run dev"
echo "  4. Open: http://localhost:8080"
