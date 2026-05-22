# PR #232 — [refactor]: Optimize docker compose with build caching and dependency isolation

> **Merged:** 2026-05-18 | **Author:** @harshitsaxena214 | **Area:** DevOps | **Impact Score:** 11 | **Closes:** #218

## What Changed

We refactored our local Docker Compose setup to leverage dedicated `Dockerfile`s for the `web` and `api` services (`apps/web/Dockerfile`, `apps/api/Dockerfile`) instead of generic Node runtime images. This change introduces multi-stage Docker builds for development and production, moves dependency installation to the image build phase, and implements anonymous volume overrides to ensure container dependency isolation.

## The Problem Being Solved

Before this PR, our Docker Compose setup for local development suffered from several inefficiencies. We repeatedly installed Node.js dependencies on every `docker compose up` command, leading to significant startup latency. There was also a risk of host machine `node_modules` being mounted into the containers, causing native binary mismatches and polluting the container environment. Furthermore, the development workflow was not aligned with our production Docker build processes, creating inconsistencies and potential for subtle environment-related bugs.

## Files Modified

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `docker-compose.yml`

## Implementation Details

This refactor involved significant changes to our Docker build and orchestration configuration:

**1. `docker-compose.yml` Updates:**
   - The `web` and `api` services were updated to use a `build` directive instead of directly specifying a `node:24-alpine` `image`.
     - `build.context` is set to `.`, indicating the project root as the build context.
     - `build.dockerfile` now points to `apps/web/Dockerfile` and `apps/api/Dockerfile` respectively, instructing Docker Compose to use our custom service Dockerfiles.
     - `build.target` is explicitly set to `development`, ensuring that our local development environment utilizes the optimized development stage defined within the Dockerfiles.
   - The `working_dir` for both services was standardized to `/app`, aligning with the root `WORKDIR` defined in the Dockerfiles.
   - The `command` for both services was simplified from `sh -c "npm install && exec npm run dev"` to `npm run dev -w apps/web` and `npm run dev -w apps/api`. This change is possible because dependencies are now pre-installed during the image build, eliminating the need for runtime installation.
   - Anonymous volumes were added for both services to prevent host `node_modules` and build artifacts from overriding container contents:
     - For the `web` service: `- /app/node_modules`, `- /app/apps/web/node_modules`, and `- /app/apps/web/.next`.
     - For the `api` service: `- /app/node_modules` and `- /app/apps/api/node_modules`.
     These volumes effectively "hide" the host's corresponding directories from the container, ensuring the container uses its own pre-installed dependencies and build caches.

**2. `apps/api/Dockerfile` and `apps/web/Dockerfile` Refactor:**
   - Both Dockerfiles were refactored to implement multi-stage builds, starting with a `FROM node:20-alpine AS base` stage.
   - **`base` stage:**
     - Sets `WORKDIR /app`.
     - Copies the root `package.json` and `package-lock.json` to `/app`.
     - Copies the service-specific `package.json` (e.g., `apps/api/package.json`) to its respective location within `/app`.
     - Copies the shared `packages` directory to `/app/packages`.
     - Executes `RUN npm ci` to install all dependencies. This step is critical as it leverages Docker's layer caching for faster subsequent builds, only re-running if `package.json` or `package-lock.json` changes.
   - **`development` stage:**
     - `FROM base AS development`.
     - Copies the entire project context (`COPY . .`) into the image.
     - Exposes the relevant port (`EXPOSE 4000` for API, `EXPOSE 3000` for Web).
     - Sets the default command to `CMD ["npm", "run", "dev", "-w", "apps/api"]` (or `apps/web`), which starts the development server.
   - **`production` stage:**
     - `FROM base AS production`.
     - Copies the entire project context (`COPY . .`).
     - Executes `RUN npm run build -w apps/api` (or `apps/web`) to create optimized production builds.
     - For `apps/web/Dockerfile`, it exposes `EXPOSE 3000` and sets the default command to `CMD ["npm", "start", "-w", "apps/web"]`.
     - For `apps/api/Dockerfile`, the production stage includes `COPY . .` and `RUN npm run build -w apps/api`, but a `CMD` for the production stage is not explicitly defined in this PR's diff.

## Technical Decisions

We chose to implement multi-stage Docker builds (`base`, `development`, `production`) for both our `apps/web` and `apps/api` services. This approach was selected primarily to leverage Docker's layer caching mechanism, significantly reducing build times and eliminating redundant dependency installations during local development. By installing dependencies via `RUN npm ci` in the `base` stage, we ensure that these layers are cached and only rebuilt when `package.json` or `package-lock.json` changes, leading to much faster `docker compose up` cycles.

The use of `npm ci` specifically, rather than `npm install`, was a deliberate choice to ensure reproducible builds by strictly adhering to the `package-lock.json` file.

The decision to use anonymous volume overrides (e.g., `- /app/node_modules`) was critical to prevent host-mounted `node_modules` directories from overwriting the container's pre-installed dependencies. This solves issues related to native module mismatches (e.g., `node-sass` binaries) and ensures that the container environment is self-contained and consistent, regardless of the host's `node_modules` state.

Aligning the development `docker-compose.yml` with the service-specific `Dockerfile`s, targeting the `development` stage, ensures that our local environment closely mirrors how our applications are built and run in production, reducing "it works on my machine" scenarios.

## How To Re-Implement (Contributor Reference)

To re-implement or extend this pattern for a new service within our monorepo, a contributor would follow these steps:

1.  **Create a Service-Specific Dockerfile:**
    *   In the new service's directory (e.g., `apps/new-service/Dockerfile`), define a multi-stage Dockerfile.
    *   **`base` stage:**
        ```dockerfile
        FROM node:20-alpine AS base
        WORKDIR /app
        COPY package.json package-lock.json ./
        COPY apps/new-service/package.json ./apps/new-service/
        COPY packages ./packages
        RUN npm ci
        ```
    *   **`development` stage:**
        ```dockerfile
        FROM base AS development
        COPY . .
        EXPOSE <port_number> # e.g., 5000
        CMD ["npm", "run", "dev", "-w", "apps/new-service"]
        ```
    *   **`production` stage:**
        ```dockerfile
        FROM base AS production
        COPY . .
        RUN npm run build -w apps/new-service
        EXPOSE <port_number> # e.g., 5000
        CMD ["npm", "start", "-w", "apps/new-service"] # Or appropriate production command
        ```

2.  **Update `docker-compose.yml`:**
    *   Add a new service entry for `new-service`.
    *   Configure the `build` directive to use the new Dockerfile and target the `development` stage:
        ```yaml
        new-service:
          build:
            context: .
            dockerfile: apps/new-service/Dockerfile
            target: development
          working_dir: /app
          volumes:
            - .:/app
            - /app/node_modules
            - /app/apps/new-service/node_modules
            # Add other service-specific cache directories if needed (e.g., /app/apps/new-service/.next for Next.js)
          command: npm run dev -w apps/new-service
          ports:
            - "<host_port>:<container_port>" # e.g., "5000:5000"
          environment:
            # Add any necessary environment variables
            - NODE_ENV=development
        ```

**Gotchas:**
*   Ensure `package.json` and `package-lock.json` (and the service-specific `package.json`) are copied *before* `npm ci` in the `base` stage to maximize Docker layer caching.
*   The anonymous volumes (e.g., `- /app/node_modules`) are crucial for preventing host `node_modules` from interfering with the container's dependencies. Forgetting these will reintroduce host/container dependency conflicts.
*   The `working_dir` in `docker-compose.yml` should consistently be `/app` to align with the `WORKDIR` defined in the Dockerfiles.

## Impact on System Architecture

This refactor significantly improves the developer experience by drastically reducing `docker compose up` startup times and ensuring a more consistent development environment. By aligning our local Docker setup with production build patterns, we minimize potential discrepancies between development and deployment, leading to more robust and predictable application behavior. This change also lowers the barrier to entry for new contributors, as they no longer need to troubleshoot host-specific dependency issues or wait for lengthy `npm install` commands on every startup. It solidifies our monorepo's Docker strategy, making it easier to onboard new services with a standardized, performant, and isolated development setup.

## Testing & Verification

The primary verification involved running `docker compose up` and confirming that both the `web` (Next.js frontend) and `api` (Node.js/Express backend) services started correctly and were accessible on their respective ports (3000 and 4000). We confirmed that dependencies were installed only during the initial image build and not on subsequent container startups, demonstrating the effectiveness of Docker layer caching. The `npm run dev -w web` and `npm run dev -w api` commands, as specified in the contributor checklist, were executed within the Docker containers to ensure the development servers functioned as expected.

Edge cases addressed by this PR include preventing host `node_modules` from interfering with container dependencies (e.g., ensuring native modules compile correctly within the container's Linux environment) and handling scenarios where `package.json` or `package-lock.json` changes, triggering an efficient rebuild of only the affected Docker layers. No specific new test scripts were added as part of this refactor; verification was performed through manual functional testing of the local development environment.