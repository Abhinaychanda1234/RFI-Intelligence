# 🚀 RFI Genie v2.0 — Setup Guide

## The Blank Screen Fix

The blank screen was caused by 4 issues — all now fixed:
1. `tailwind.config.ts` → renamed to `.js` (TypeScript `require()` errors)
2. `axios` added to `package.json` (was missing)
3. `remark-gfm` added properly
4. `vite.config.ts` now proxies `/api` → `http://localhost:3001`

---

## Step 1: Install Dependencies

Open two terminals in the `rfi-genie` folder:

**Terminal 1 — Frontend:**
```bash
npm install
```

**Terminal 2 — Backend:**
```bash
cd backend
npm install
```

---

## Step 2: Add Your OpenAI API Key

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set:
```
OPENAI_API_KEY=
```

Get a key at: https://platform.openai.com/api-keys

**Or for Azure OpenAI**, set `USE_AZURE_OPENAI=true` and fill in:
```
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com/
AZURE_OPENAI_API_KEY=<your-azure-openai-key>
```
Get your Azure OpenAI keys from: https://portal.azure.com → Azure OpenAI → Keys and Endpoint

---

## Step 3: Run

**Terminal 1 — Backend (start this FIRST):**
```bash
cd backend
npm run dev
```
You should see: `RFI Genie Backend  v2.0 — Port: 3001`

**Terminal 2 — Frontend:**
```bash
npm run dev
```
Open: http://localhost:8080

---

## Verify It's Working

Visit: http://localhost:3001/health

You should see:
```json
{"status":"ok","version":"2.0.0","mode":"openai"}
```

---

## Azure Deployment

```bash
az login
chmod +x deploy-azure.sh
OPENAI_API_KEY=sk-your-key ./deploy-azure.sh
```

---

## Common Errors

| Error | Fix |
|---|---|
| Blank white screen | Run `npm install` in root folder |
| 404 on /api/... | Start the backend: `cd backend && npm run dev` |
| `Cannot find module 'axios'` | Run `npm install` again |
| `tailwind.config.ts` errors | Already fixed — now uses `.js` |
| AI responses not streaming | Check `OPENAI_API_KEY` in `backend/.env` |
