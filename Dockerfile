FROM node:20-slim

RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Install everything including devDependencies (needed to compile TypeScript)
RUN npm ci

COPY . .

RUN npx prisma generate

# Build with visible output so errors are not hidden
RUN npm run build && echo "✅ Build succeeded" && ls -la dist/

# Fail loudly with a clear message if build output is missing
RUN test -f dist/main.js || (echo "❌ dist/main.js missing - TypeScript compile failed above" && exit 1)

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]