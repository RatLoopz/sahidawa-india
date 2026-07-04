# SahiDawa — Local Setup Guide for Contributors

Welcome to SahiDawa! This guide will help you set up the project on your local machine so you can start contributing.

SahiDawa is a **Monorepo**. It contains three main applications:

1. **Frontend (`apps/web`)**: Next.js React application.
2. **API Backend (`apps/api`)**: Node.js Express server.
3. **ML Backend (`apps/ml`)**: Python FastAPI service for AI features.

You can choose to run **only the Frontend** (recommended for UI/UX tasks) or the **Full Stack** (recommended for backend/AI tasks).

---

## 🛠 Prerequisites

Before you start, make sure you have the following installed:

- **Node.js** (v20 or higher)
- **npm** (v10 or higher)
- **Git**
- **Python** (v3.10 or higher) - _Only required for ML Backend_
- **Docker** - _Optional, but highly recommended for Full Stack setup_

Verify your installation by running these commands in your terminal:

```bash
node -v
npm -v
git --version
```

---

## 📥 Step 1: Clone the Repository

Open your terminal, navigate to your desired folder, and clone the repository:

```bash
git clone https://github.com/RatLoopz/sahidawa-india.git
cd sahidawa-india
```

---

## ⚙️ Step 2: Set Up Environment Variables

This is the most critical step. SahiDawa requires environment variables to connect to the database and APIs.

Because SahiDawa is a Monorepo, we need **two** `.env` files:

1. One in the `apps/web` folder (for the Next.js frontend).
2. One in the root folder (for Docker and the Backend).

Run the following commands in the root of the project to copy the template files:

```bash
# 1. Create the Root .env (For Backend/Docker)
cp .env.example .env

# 2. Create the Frontend .env.local (For Next.js)
cp .env.example apps/web/.env.local
```

### Add your Supabase Keys

Open `apps/web/.env.local` and `.env` in your code editor. You must add your Supabase URL and Anon Key. If you don't have them, create a free project at [Supabase](https://supabase.com/).

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## 🚀 Step 3: Run the Project

Choose ONE of the following methods based on what you are working on:

### Option A: Run Frontend Only (Fastest)

Use this method if you are only working on UI components, translations, or Next.js pages.

```bash
# Navigate to the frontend folder
cd apps/web

# Install dependencies (If it fails on Windows, use: npm install --ignore-scripts)
npm install

# Start the development server
npm run dev
```

👉 Open your browser and go to: **[http://localhost:3000](http://localhost:3000)**

---

### Option B: Run Full Stack via Docker (Recommended)

Use this method if you are working on the API, Machine Learning features, or full-stack integrations. Docker will automatically start the Frontend, Node API, and Python ML service together.

```bash
# Make sure you are in the root directory (sahidawa-india)
# Make sure Docker Desktop is running

# Build and start all services
docker compose up --build
```

👉 **Frontend:** [http://localhost:3000](http://localhost:3000)
👉 **Node API:** [http://localhost:4000](http://localhost:4000)
👉 **Python ML API:** [http://localhost:8000](http://localhost:8000)

---

### Option C: Run Manual Full Stack (No Docker)

If you don't want to use Docker, you can run the backend services manually in separate terminal windows.

**Terminal 1: Node API**

```bash
cd apps/api
npm install
npm run dev
```

**Terminal 2: Python ML Service**

```bash
cd apps/ml
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 3: Frontend**

```bash
cd apps/web
npm run dev
```

---

## 🐞 Troubleshooting Common Issues

### 1. Supabase Connection Error

**Error:** The website loads but immediately shows a database or connection error.
**Fix:** You forgot to set up `apps/web/.env.local`. Make sure the file exists inside `apps/web` (not just the root) and contains `NEXT_PUBLIC_SUPABASE_URL`.

### 2. `npm install` Fails (No matching version found)

**Error:** `npm ERR! code ETARGET`
**Fix:** We use some cutting-edge canary packages. Run install with legacy peer deps:

```bash
npm install --legacy-peer-deps
```

### 3. Build Fails on Windows

**Error:** Fails during postinstall or prepare scripts.
**Fix:** Skip the scripts:

```bash
npm install --ignore-scripts
```

### 4. Port is Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`
**Fix:** Another app is using port 3000. Kill it or change the Next.js port by running `npm run dev -- -p 3001`.

---

🎉 **You're all set!** Happy coding, and thank you for contributing to SahiDawa. If you need help, feel free to ask in the GitHub Discussions or Discord.
