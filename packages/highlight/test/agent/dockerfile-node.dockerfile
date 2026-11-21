# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VERSION=dev
ENV NODE_ENV=production APP_VERSION=${VERSION}
RUN npm run build && \
    rm -rf src test

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
COPY --from=build /app/dist ./dist
EXPOSE 8080
USER 1000
HEALTHCHECK --interval=30s CMD ["node", "dist/health.js"]
CMD ["dist/server.js"]
