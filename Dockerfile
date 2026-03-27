# LeadHub AI Backend — Render-Compatible Dockerfile

FROM node:20-slim

# Install OpenSSL (required by Prisma)
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (so Docker caches node_modules layer)
COPY package*.json ./

# Install ALL dependencies including devDependencies (needed to compile TypeScript)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the NestJS app — this compiles TypeScript → dist/
RUN npm run build

# Show what was built so we can see it in the logs
RUN echo "=== Contents of dist/ ===" && ls -la dist/

# Confirm the critical file exists — fail loudly if not
RUN test -f dist/main.js || (echo "ERROR: dist/main.js not found. Build failed silently." && exit 1)

# Only keep what's needed to run (removes devDependencies to save memory)
RUN npm prune --production

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]