# 1. Base Image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# 2. Layer Caching for Monorepo
# Copy the root package files
COPY package.json package-lock.json ./

# Copy the workspace package files (and shared packages if they exist)
COPY apps/web/package.json ./apps/web/
# We use a wildcard so it doesn't fail if the packages folder is empty
COPY packages/ ./packages/ 

# Install dependencies using clean install
RUN npm ci

# Copy the rest of the monorepo source code
COPY . .

# Build the Next.js web application
RUN npm run build -w apps/web

# 3. Expose Port
EXPOSE 3000

# Start the application
CMD ["npm", "start", "-w", "apps/web"]