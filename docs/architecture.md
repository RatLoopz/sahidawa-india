# SahiDawa Architecture & Contributor Guide

Welcome to the SahiDawa project! To ensure smooth collaboration and prevent "works on my machine" issues, please read this brief architectural guide.

## 🏗️ Monorepo Structure (NPM Workspaces)

SahiDawa is structured as a **Monorepo** (Monolithic Repository). Instead of having separate repositories for the frontend and backend, everything lives here under one roof. We use **NPM Workspaces** to manage multiple independent sub-projects efficiently.

### Directory Layout

- **`apps/`**: Contains the actual runnable applications.
  - **`apps/web`**: Next.js 16 Frontend (React 19, Tailwind CSS v4).
  - **`apps/api`**: Node.js/Express Backend (will connect to Supabase).
  - **`apps/ml`**: Python FastAPI service (for Machine Learning and Voice/Vision Processing).

- **`packages/`**: Contains shared code that can be used across multiple apps.
  - *Example*: If we build a shared UI component library or common database schemas in the future, they will live here. Even if this folder is currently empty, do not delete it, as it is pre-configured for future scalability.

---

## 🛠️ Installation & Setup Rules

**CRITICAL: NEVER run `npm install` inside the `apps/web` or `apps/api` folders directly.**

Because this is a workspace-enabled monorepo, NPM uses **Hoisting** to share common dependencies at the root level to save disk space.

### 1. Initial Setup
When you clone the repository, navigate to the **root folder (`sahidawa-india`)** and run:
```bash
npm install
```
*This will automatically install and link all dependencies for all apps and packages.*

### 2. Adding New Packages
If you need to install a new package for a specific app, stay in the **root folder** and use the `-w` (workspace) flag:

- To add a package to the frontend:
  ```bash
  npm install <package-name> -w web
  ```
- To add a package to the backend:
  ```bash
  npm install <package-name> -w api
  ```

---

## 🚀 Running the Apps

You can start any app from the **root folder** using the workspace flag:

- **Run Frontend (Next.js):**
  ```bash
  npm run dev -w web
  ```
- **Run Backend (Express):**
  ```bash
  npm run dev -w api
  ```

---

## 📦 Versioning & Dependency Locking

We strictly use exact versions or locked ranges (e.g., `^16.2.4`) in our `package.json` files instead of `"latest"`. 

**Why?** 
If we used `"latest"`, two contributors cloning the repo on different days might get different versions of Next.js or React, leading to severe version mismatch errors and broken builds.

By locking the versions:
1. Every contributor runs the exact same environment.
2. The `package-lock.json` at the root guarantees deterministic installations.

**Current Tech Stack Versions (Locked):**
- Next.js: `v16.2.4`
- React: `v19.x`
- Tailwind CSS: `v4.x`

*Happy Coding! 🚀*
