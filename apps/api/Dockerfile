FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages ./packages

RUN npm ci

FROM base AS development

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev", "-w", "apps/api"]

FROM base AS production

COPY . .

RUN npm run build -w apps/api

EXPOSE 4000

CMD ["npm", "start", "-w", "apps/api"]