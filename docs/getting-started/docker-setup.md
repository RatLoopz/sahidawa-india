# SahiDawa — Docker Setup Guide for Contributors 🐳

SahiDawa is a complex application with a Next.js frontend, a Node.js API, a Python ML service, Redis, and Jaeger for OpenTelemetry tracing. Running all these manually can be difficult.

**Docker** makes this incredibly easy. With one command, you can spin up the entire SahiDawa infrastructure locally.

---

## 🛠 Prerequisites

Before starting, ensure you have:

1. **Docker Desktop** installed and running on your machine ([Download here](https://www.docker.com/products/docker-desktop)).
2. **Git** installed to clone the repository.

_Note: You do NOT need Node.js or Python installed locally if you use Docker! Everything runs inside isolated containers._

---

## 📥 Step 1: Clone the Repository

```bash
git clone https://github.com/RatLoopz/sahidawa-india.git
cd sahidawa-india
```

---

## ⚙️ Step 2: Configure Environment Variables

Docker needs to know your Supabase and API credentials.

1. Copy the example `.env` file to the root of the project:
    ```bash
    cp .env.example .env
    ```
2. Open the `.env` file and fill in your keys (You only need `SUPABASE_URL` and `SUPABASE_ANON_KEY` to get the app running basically).

> **Important:** Docker reads the **root `.env`** file to pass variables to all containers (web, api, ml). You don't need to manually create `.env.local` inside `apps/web` if you are using Docker, because `docker-compose.yml` mounts the root variables.

---

## 🚀 Step 3: Start the Project

Make sure Docker Desktop is open and running in the background. Then, in your terminal, run:

```bash
docker compose up --build
```

**What this command does:**

1. Builds the Next.js Frontend image (`web`).
2. Builds the Node.js API image (`api`).
3. Builds the Python ML API image (`ml`).
4. Pulls the Redis and Jaeger images.
5. Starts all 5 containers and links them via an internal network.

The first time you run this, it may take 5–10 minutes to download all dependencies. Subsequent runs will take seconds.

---

## 🌐 Step 4: Access the Services

Once the terminal shows that the servers are listening, you can access them at:

| Service          | Local URL                                                    | Description                   |
| ---------------- | ------------------------------------------------------------ | ----------------------------- |
| **Frontend App** | [http://localhost:3000](http://localhost:3000)               | The main SahiDawa UI          |
| **API Backend**  | [http://localhost:4000/health](http://localhost:4000/health) | Node.js Express server        |
| **ML Backend**   | [http://localhost:8000/docs](http://localhost:8000/docs)     | Python FastAPI Swagger Docs   |
| **Jaeger UI**    | [http://localhost:16686](http://localhost:16686)             | View API telemetry and traces |

---

## 🛑 Step 5: Stopping the Services

To stop the app, simply press `Ctrl + C` in the terminal where Docker is running.

If you want to stop it from another terminal and remove the containers completely, run:

```bash
docker compose down
```

---

## 🐞 Troubleshooting Common Docker Errors

### 1. Port is Already in Use

**Error:** `listen tcp4 0.0.0.0:3000: bind: address already in use`
**Fix:** Another app on your computer is using port 3000 (maybe a local React app). Kill it, or edit `docker-compose.yml` to map a different port for the web service (e.g., `"3001:3000"`).

### 2. File Syncing (Hot-Reload) Not Working on Windows

**Error:** You change code in VS Code, but the browser doesn't update.
**Fix:** This happens if Docker is using WSL2 but your project is cloned on the Windows file system.
Move your project into the WSL filesystem (e.g., `\\wsl$\Ubuntu\home\user\sahidawa-india`) and run Docker from there.

### 3. Missing Medicines CSV Error

**Error:** `WARNING [routers.verify] Verification medicine database failed to load: Medicine seed CSV not found.`
**Fix:** The ML container expects `data/seeds/medicines.csv` to exist. Make sure you have pulled the latest branch and haven't deleted the `data/` folder.

### 4. Npm Install Fails Inside Docker

**Error:** Docker build fails on the `npm install` step.
**Fix:** Sometimes the cached Docker image gets corrupted. Run a completely fresh build without using cache:

```bash
docker compose build --no-cache
docker compose up
```
