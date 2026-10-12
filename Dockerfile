FROM node:24-alpine
WORKDIR /app
COPY server ./server
COPY pipeline/names.mjs ./pipeline/names.mjs
COPY web ./web
ENV PORT=8092 DB=/data/powermap.db WEB=/app/web NODE_ENV=production
EXPOSE 8092
CMD ["node", "server/server.mjs"]
