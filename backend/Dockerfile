FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src/ src/

ENV PORT=3001
ENV DB_PATH=/data/mining.db

EXPOSE 3001

CMD ["node", "src/index.js"]
