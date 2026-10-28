# FilamentHub - Dockerfile für Raspberry Pi (ARM64) & x86_64
FROM node:22-alpine

WORKDIR /app

# System dependencies
RUN apk add --no-cache python3 make g++

# Kopiere Package-Definitionen
COPY package.json ./

# Installiere Produktiv- & Build-Abhängigkeiten
RUN npm install

# Kopiere Quellcode
COPY . .

# Erstelle persistentes Datenverzeichnis für Spulen & Stats
RUN mkdir -p /app/data

# Baue Frontend-Bundle
RUN npm run build

# Port 3000 freigeben
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Starte Express & Vite Server
CMD ["npm", "start"]
