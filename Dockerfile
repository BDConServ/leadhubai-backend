# LeadHub AI Backend v2
# rebuild: 1
FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

RUN npx prisma generate

RUN npm run build || (echo "BUILD FAILED" && exit 1)

RUN ls -la dist/ && test -f dist/main.js || (echo "dist/main.js MISSING" && exit 1)

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]