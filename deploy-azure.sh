#!/bin/bash
# ============================================================
# RFI Genie v2.0 — Azure Deployment Script
# ============================================================
set -e

RESOURCE_GROUP="rg-rfi-genie"
LOCATION="eastus"
APP_NAME="rfi-genie"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}ℹ  $1${NC}"; }
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }

echo -e "\n╔══════════════════════════════════════╗"
echo -e "║   RFI Genie v2.0 — Azure Deploy    ║"
echo -e "╚══════════════════════════════════════╝\n"

command -v az >/dev/null || fail "Azure CLI not installed. Visit https://aka.ms/install-azure-cli"
command -v node >/dev/null || fail "Node.js not installed"
command -v zip >/dev/null || fail "zip not installed"

az account show >/dev/null 2>&1 || az login

[ -z "$OPENAI_API_KEY" ] && { read -rsp "Enter OpenAI API Key (sk-...): " OPENAI_API_KEY; echo ""; }
[ -z "$OPENAI_API_KEY" ] && fail "OpenAI API key required"

# Build
info "Building backend..."
cd backend && npm install && npm run build && cd ..

info "Building frontend..."
npm install && npx vite build

# Azure resources
info "Creating resource group..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

info "Deploying infrastructure..."
OUTPUT=$(az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/main.bicep \
  --parameters appName="$APP_NAME" openAiApiKey="$OPENAI_API_KEY" \
  --query "properties.outputs" -o json)

WEB_APP=$(echo "$OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['webAppName']['value'])")
URL=$(echo "$OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['webAppUrl']['value'])")

# Package
info "Packaging..."
rm -rf _deploy && mkdir _deploy
cp -r backend/dist _deploy/backend
cp backend/package.json _deploy/backend/
mkdir -p _deploy/public && cp -r dist/* _deploy/public/
cd _deploy && zip -r ../app.zip . && cd ..

# Deploy
info "Deploying application..."
az webapp deploy --resource-group "$RESOURCE_GROUP" --name "$WEB_APP" --src-path app.zip --type zip --output none

rm -rf _deploy app.zip

echo -e "\n╔══════════════════════════════════════════╗"
echo -e "║  🚀 DEPLOYED!                            ║"
echo -e "║  URL: $URL   ║"
echo -e "╚══════════════════════════════════════════╝\n"
ok "Visit: $URL"
