# LeadHub AI Backend v2
# rebuild: 3

FROM node:20-slim

# Fix Prisma/OpenSSL issue on node:20-slim
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --include=dev

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build and show output for debugging
RUN npm run build || (echo "BUILD FAILED" && exit 1)

# Show what was built
RUN echo "=== dist/ contents ===" && ls -la dist/ || echo "dist/ folder missing"

# Verify main.js exists
RUN test -f dist/main.js || (echo "dist/main.js MISSING - check tsconfig outDir" && exit 1)

EXPOSE 3000

CMD ["node", "dist/main.js"]