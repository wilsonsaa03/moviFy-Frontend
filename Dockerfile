# ─────────────────────────────────────────────────────────────
#  MoviFY web — imagen para Dokploy: compila Angular y lo sirve con nginx (puerto 80).
# ─────────────────────────────────────────────────────────────

# 1) Compilar
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build -- --configuration production

# 2) Servir
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/browser /usr/share/nginx/html
EXPOSE 80
