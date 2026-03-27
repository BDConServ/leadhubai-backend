# LeadHub AI Backend v2
# rebuild: 1
FROM node:20-slim

WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies including dev (needed for build)
RUN npm ci --include=dev

# Copy all source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the app - exit loudly if it fails
RUN npm run build || (echo "BUILD FAILED" && exit 1)

# Verify dist/main.js was actually created
RUN ls -la dist/ && test -f dist/main.js || (echo "dist/main.js MISSING" && exit 1)

EXPOSE 3000

CMD ["node", "dist/main.js"]