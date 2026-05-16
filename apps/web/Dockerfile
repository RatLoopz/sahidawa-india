FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

COPY apps/web/package.json ./apps/web/

COPY packages/ ./packages/ 

RUN npm ci

COPY . .

RUN npm run build -w apps/web

EXPOSE 3000

# Start the application
CMD ["npm", "start", "-w", "apps/web"]