FROM node:20-slim

RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npx prisma generate

# Run TypeScript compiler directly to see ALL errors clearly
RUN echo "=== Running TypeScript compiler ===" && \
    ./node_modules/.bin/tsc --noEmit 2>&1 || true

# Now run the actual build
RUN echo "=== Running nest build ===" && \
    ./node_modules/.bin/nest build 2>&1

# Show everything in dist
RUN echo "=== dist/ contents ===" && \
    ls -la dist/ 2>&1 || echo "dist/ folder does not exist at all"

RUN test -f dist/main.js || (echo "❌ dist/main.js missing - see TypeScript errors above" && exit 1)

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]