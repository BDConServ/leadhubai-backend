# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Install ALL dependencies (including devDependencies for build)
COPY package*.json ./
RUN npm ci

# Copy source code and config files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript → JavaScript into /app/dist
RUN npm run build

# List what was built (helps debug if something goes wrong)
RUN ls -la dist/ || echo "dist folder is empty or missing"

# Confirm the critical file exists
RUN test -f dist/main.js || (echo "ERROR: dist/main.js not found" && exit 1)

# ── Stage 2: Run ────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Install OpenSSL for Prisma at runtime too
RUN apk add --no-cache openssl

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/main.js"]