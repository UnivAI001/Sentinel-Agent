# Dockerfile for sandboxed scanning
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY scanner-worker.js ./

# Start idle or run long-standing process
CMD ["node", "scanner-worker.js"]
