FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run learning:build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist-server/learning ./dist-server/learning
COPY --from=build /app/server/learning/migrations ./server/learning/migrations
USER node
EXPOSE 8791
CMD ["node", "dist-server/learning/server.mjs"]
