FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY backend ./backend
RUN npm ci --ignore-scripts && npm run backend:build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/backend/dist ./backend/dist
USER node
EXPOSE 8788
CMD ["node", "backend/dist/src/server.js"]

