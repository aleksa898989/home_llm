# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    WEB_DIR=/app/dist/web

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY shared ./shared
COPY server/src ./server/src
COPY --from=build /app/dist/web ./dist/web

RUN printf '#!/bin/sh\nexec node --disable-warning=ExperimentalWarning /app/server/src/cli.ts "$@"\n' > /usr/local/bin/admin \
  && chmod +x /usr/local/bin/admin \
  && mkdir -p /data && chown node:node /data

USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/auth/status >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/main.ts"]
