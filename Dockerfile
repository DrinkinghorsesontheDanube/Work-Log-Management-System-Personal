# ---- 构建前端 ----
FROM node:24-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci
COPY frontend ./frontend
RUN cd frontend && npm run build

# ---- 运行镜像 ----
FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/frontend/dist ./frontend/dist
COPY server ./server

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173
ENV DATA_DIR=/app/data

VOLUME ["/app/data"]
EXPOSE 4173

CMD ["node", "server/server.js"]
