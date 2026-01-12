# The Archive

A Notion-inspired media tracking dashboard for films, TV series, and books. Built with React, TypeScript, Tailwind CSS, and Vercel Serverless Functions.

![The Archive](https://img.shields.io/badge/React-19-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-blue) ![Vercel](https://img.shields.io/badge/Vercel-Serverless-black)

## ✨ Features

- **Unified Data Model**: Single items collection with flexible properties for all media types
- **Notion-like Tables**: Inline editing, sortable columns, configurable visibility
- **Cross-Category Search**: Click any tag to see all items across all databases
- **Simple Auth**: Shared password for group access, nicknames for tracking who added/watched
- **Real-time Updates**: Automatic polling for live collaboration
- **Beautiful Design**: Archival brutalist aesthetic with custom typography

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  React + TypeScript + Tailwind + Zustand                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Serverless API                     │
│  /api/auth/login    - Authentication                        │
│  /api/items         - CRUD operations                       │
│  /api/items/[id]    - Single item operations                │
│  /api/tags          - Get all tags                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Storage                            │
│  Currently: In-memory (demo)                                │
│  Production: Vercel KV / Postgres / MongoDB                 │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm
- [Vercel CLI](https://vercel.com/docs/cli) (for full-stack development)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/the-archive.git
cd the-archive

# Install dependencies
npm install

# Install Vercel CLI globally (if not already installed)
npm install -g vercel
```

### Local Development

**Option 1: Frontend only**
```bash
npm run dev
```
This runs just the Vite dev server. API calls will fail but you can see the UI.

**Option 2: Full-stack with Vercel (recommended)**
```bash
# First time: Link to Vercel project
vercel link

# Run with serverless functions
npm run dev:vercel
# or directly:
vercel dev
```
This runs both frontend AND the API routes locally.

### Default Login

- **Nickname**: Any name you want (e.g., "Alex")
- **Password**: `archive2024` (configurable via env)

## 📁 Project Structure

```
the-archive/
├── api/                      # Vercel Serverless Functions
│   ├── _shared/              # Shared utilities
│   │   └── db.ts             # Database & password validation
│   ├── auth/
│   │   └── login.ts          # POST /api/auth/login
│   ├── items/
│   │   ├── index.ts          # GET/POST /api/items
│   │   ├── [id].ts           # GET/PUT/DELETE /api/items/:id
│   │   └── [id]/
│   │       └── toggle.ts     # POST /api/items/:id/toggle
│   └── tags/
│       └── index.ts          # GET /api/tags
├── src/
│   ├── components/
│   │   ├── layout/           # Header, navigation
│   │   └── ui/               # shadcn/ui components
│   ├── features/
│   │   ├── auth/             # Login form
│   │   └── items/            # Table, filters, dialogs
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utilities, API client
│   ├── pages/                # Page components
│   ├── stores/               # Zustand state stores
│   └── types/                # TypeScript definitions
├── vercel.json               # Vercel configuration
└── package.json
```

## 🌐 Deployment to Vercel

### Step 1: Push to GitHub

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: The Archive"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/the-archive.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Vercel

**Option A: Via Vercel Dashboard (Recommended)**

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Vercel auto-detects Vite - keep the defaults
5. Add Environment Variable:
   - Name: `ARCHIVE_PASSWORD`
   - Value: Your chosen password (e.g., `mysecretpassword123`)
6. Click **"Deploy"**

**Option B: Via CLI**

```bash
# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# For production deployment
vercel --prod
```

### Step 3: Set Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables:

| Name | Value | Environment |
|------|-------|-------------|
| `ARCHIVE_PASSWORD` | `your-secure-password` | Production, Preview, Development |

## 🔧 API Reference

### Authentication

```http
POST /api/auth/login
Content-Type: application/json

{
  "nickname": "Alex",
  "password": "archive2024"
}
```

### Items

```http
# List all items (with optional filters)
GET /api/items?category=Films&status=Watched&tags=sci-fi

# Create item
POST /api/items
{
  "title": "Dune",
  "category": "Films",
  "addedBy": "Alex",
  "status": "Watched",
  "tags": ["sci-fi", "epic"],
  "properties": {
    "director": "Denis Villeneuve",
    "year": 2021
  }
}

# Update item
PUT /api/items/:id
{ "status": "Watched", "properties": { "rating": 4.8 } }

# Delete item
DELETE /api/items/:id

# Toggle user in watchedBy/plannedBy
POST /api/items/:id/toggle
{ "field": "watchedBy", "nickname": "Alex" }
```

## 🎨 Design System

**Aesthetic**: Archival Brutalism - Like a curator's private vault

- **Fonts**: 
  - Cormorant Garamond (titles, cultural gravitas)
  - JetBrains Mono (data, systematic feel)
- **Colors**: Stone palette with amber accents
- **Theme**: Dark, refined, content-first

## 🔒 Security Notes

- This is designed as a **shared app for friends/small groups**
- Single shared password - no personal accounts
- For production, consider:
  - Using a real database (Vercel KV, Postgres)
  - Adding rate limiting
  - Using environment-specific passwords

## 📝 Adding a Real Database

The current implementation uses in-memory storage (resets on each deployment). To persist data:

1. **Vercel KV** (Redis-like, easy setup)
2. **Vercel Postgres** (SQL, good for complex queries)
3. **MongoDB Atlas** (Document DB, flexible schema)
4. **Supabase** (Postgres + realtime)

## 📄 License

MIT

---

Built with ❤️ for tracking cultural consumption with friends.
