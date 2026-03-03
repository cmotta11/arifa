FROM node:20-alpine AS base

WORKDIR /app

COPY package.json package-lock.json* ./

# ---------- Dev ----------
FROM base AS dev

RUN npm install

COPY . .

EXPOSE 5173

# ---------- Prod ----------
FROM base AS prod

RUN npm ci

COPY . .

RUN npm run build

FROM nginx:alpine AS prod-serve
COPY --from=prod /app/dist /usr/share/nginx/html
EXPOSE 80
