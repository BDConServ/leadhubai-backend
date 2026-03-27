# LeadHub AI Backend v2
# rebuild: 2

FROM node:20-slim

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

# Show what was built so we can debug if needed
RUN echo "=== dist/ contents ===" && ls -la dist/ || echo "dist/ folder missing"

# Check for main.js specifically
RUN test -f dist/main.js || (echo "dist/main.js MISSING - check tsconfig outDir" && exit 1)

EXPOSE 3000

CMD ["node", "dist/main.js"]