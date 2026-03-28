FROM node:20-alpine

# Install OpenSSL — required by Prisma on Alpine Linux
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files first (faster rebuilds)
COPY package*.json ./
RUN npm install

# Copy Prisma schema and generate the client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy all source code
COPY . .

# Build the app
RUN npm run build

EXPOSE 3000

# Skip migrate deploy — tables already exist in Supabase
# Just start the server directly
CMD ["node", "dist/main.js"]
