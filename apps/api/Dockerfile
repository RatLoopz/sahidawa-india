FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

COPY apps/api/package.json ./apps/api/

COPY packages/ ./packages/ 

RUN npm ci

COPY . .

RUN npm run build -w apps/api

EXPOSE 4000

CMD ["npm", "start", "-w", "apps/api"]