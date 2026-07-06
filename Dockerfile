# Production image for both the web app and the worker (compose picks the command).
FROM node:20-bookworm-slim

# openssl for Prisma, fonts for SVG text rendering via sharp/librsvg
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates fontconfig fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
