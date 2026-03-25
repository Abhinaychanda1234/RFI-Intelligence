# RFI Intelligence — RFI Genie v2.0

An AI-powered Request for Information (RFI) management platform built with React + TypeScript on the frontend and Node.js/Express on the backend, deployed on Azure.

---

## Features

- **AI Chat** — Conversational AI assistant powered by Azure OpenAI (GPT-4o) for RFI queries
- **Generate RFI** — Auto-generate structured RFI responses with vendor/country/region/vertical context
- **Knowledge Base** — Upload and semantically search internal documents
- **Document Management** — Manage RFI-related documents with metadata tagging
- **RFI History** — Track and review all generated RFI responses
- **Admin Panel** — Configure AI settings, manage knowledge base, and audit logs
- **Dashboard** — Overview of stats, recent activity, and charts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, TypeScript, better-sqlite3 |
| AI | Azure OpenAI (GPT-4o + text-embedding-ada-002) |
| Storage | Azure Blob Storage (optional) / local disk |
| Deployment | Azure Static Web Apps (frontend) + Azure App Service (backend) |

---

## Quick Start

See [SETUP.md](./SETUP.md) for detailed setup and deployment instructions.

```bash
# 1. Install frontend dependencies
npm install

# 2. Install backend dependencies
cd backend && npm install && cd ..

# 3. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env and fill in your Azure OpenAI credentials

# 4. Run backend
cd backend && npm run dev

# 5. Run frontend (separate terminal)
npm run dev
```

Open: http://localhost:8080

---

## Azure Deployment

```bash
az login
chmod +x deploy-azure.sh
OPENAI_API_KEY=sk-your-key ./deploy-azure.sh
```

For Azure OpenAI, set `USE_AZURE_OPENAI=true` and fill in `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY` in `backend/.env` before deploying.

---

## Project Structure

```
RFI-Intelligence/
├── src/                  # React frontend
│   ├── pages/            # Dashboard, AIChat, GenerateRFI, etc.
│   ├── components/       # UI components (shadcn/ui based)
│   └── services/api.ts   # Frontend API client
├── backend/
│   └── src/
│       ├── routes/       # Express API routes
│       ├── services/     # AI, document, export services
│       └── database/     # SQLite schema & init
├── infra/main.bicep      # Azure Bicep IaC
└── .github/workflows/    # CI/CD pipelines
```
