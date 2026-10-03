# NEXIA — imagem do server.js para o Cloudflare Container (ADR-HOST-01).
# O site é compilado aqui; VITE_NEXIA_API_URL vazio = API no mesmo endereço do site.
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY . .
RUN npm run build && rm -rf src
EXPOSE 8080
USER node
CMD ["node", "server.js"]
