# TeamsSecretary

A Microsoft Teams personal assistant bot powered by Claude AI.  
Send meeting transcripts, tasks, notes, and ideas — get them organised automatically and visible on a personal web dashboard.

---

## How it works

```
Teams message → Bot Framework → Claude AI → PostgreSQL → Dashboard
```

1. You send a message to the bot in Teams
2. The bot detects the type (meeting / task / note / idea)
3. Claude processes and structures the content
4. The result is saved to PostgreSQL on Railway
5. Your dashboard at `your-app.railway.app` shows everything

---

## Project Structure

```
/
├── server.js                  # Entry point — Express + DB init
├── src/
│   ├── bot/botHandler.js      # Teams message handler, type detection, reply
│   ├── ai/claudeProcessor.js  # Claude prompts per input type
│   ├── db/
│   │   ├── client.js          # PostgreSQL pool + schema init
│   │   └── queries.js         # DB read/write operations
│   ├── routes/
│   │   ├── bot.js             # POST /api/messages (Bot Framework)
│   │   └── api.js             # GET/DELETE /api/items, /api/stats
│   └── dashboard/
│       ├── index.html         # Dashboard SPA
│       ├── styles.css
│       └── app.js
├── .env.example
├── railway.toml
└── package.json
```

---

## Setup Guide

### 1. Prerequisites

- Node.js 18+
- A [Railway](https://railway.app) account
- An [Anthropic API key](https://console.anthropic.com)
- A Microsoft Azure account (free tier works)

---

### 2. Register the Bot on Azure

1. Go to [Azure Portal](https://portal.azure.com) → **Create a resource** → search **Azure Bot**
2. Fill in:
   - **Bot handle**: `teamssecretary` (or any name)
   - **Subscription / Resource Group**: create new or use existing
   - **Pricing tier**: F0 (free)
   - **Type of App**: Multi Tenant
3. Click **Review + Create** → **Create**
4. Once created, go to the bot resource → **Configuration**:
   - Copy the **Microsoft App ID** → save as `MICROSOFT_APP_ID`
   - Click **Manage Password** → **New client secret** → copy the value → save as `MICROSOFT_APP_PASSWORD`
5. Under **Channels** → Add **Microsoft Teams** channel → Save

---

### 3. Deploy to Railway

1. Fork or push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Select your repo
4. Add a **PostgreSQL** plugin inside the project (Railway injects `DATABASE_URL` automatically)
5. Set environment variables in Railway dashboard:

```
ANTHROPIC_API_KEY=...
MICROSOFT_APP_ID=...
MICROSOFT_APP_PASSWORD=...
PORT=3000
```

6. Railway will auto-deploy. Copy your public URL (e.g. `https://teamssecretary.up.railway.app`)

---

### 4. Connect Bot to Railway

1. Back in Azure Portal → your bot → **Configuration**
2. Set **Messaging endpoint** to:
   ```
   https://your-app.up.railway.app/api/messages
   ```
3. Save

---

### 5. Add Bot to Teams

1. In Azure Portal → your bot → **Channels** → **Microsoft Teams** → **Open in Teams**
2. Or go to Teams → Apps → search your bot name → Add

---

### 6. Local Development

```bash
# Clone and install
git clone https://github.com/betterikeproject-a11y/teamssecretary.git
cd teamssecretary
npm install

# Copy and fill in env vars
cp .env.example .env

# Start (requires a running Postgres and valid API keys)
npm run dev
```

For local Teams testing, use [ngrok](https://ngrok.com) to expose your local server:
```bash
ngrok http 3000
# Use the https URL as your Azure bot messaging endpoint
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) |
| `MICROSOFT_APP_ID` | Azure Bot App ID |
| `MICROSOFT_APP_PASSWORD` | Azure Bot App Password (client secret) |
| `DATABASE_URL` | PostgreSQL connection string (auto-set by Railway) |
| `PORT` | Server port (default: 3000) |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/messages` | Bot Framework webhook (Teams) |
| `GET` | `/api/items` | All items (optional `?type=meeting\|task\|note\|idea`) |
| `GET` | `/api/items/:id` | Single item |
| `DELETE` | `/api/items/:id` | Delete item |
| `GET` | `/api/stats` | Count per type |
| `GET` | `/` | Web dashboard |

---

## Input Examples

**Meeting transcript:**
> "Attendees: Ike, Sarah. Discussed Q2 roadmap. Decided to launch feature X in May. Action items: Ike to write spec by Friday."

**Task:**
> "Task: Review the onboarding design due Thursday"

**Note:**
> "Remember to check the new API rate limits before the next sprint"

**Idea:**
> "Idea: What if the bot could also summarise email threads?"
