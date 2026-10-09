# build context: backend/; one image per Nest app via --build-arg APP=images|logs

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
ARG APP
COPY nest-cli.json tsconfig.json ./
COPY apps ./apps
COPY libs ./libs
COPY proto ./proto
# rspack strips types without checking them, so type-check here against the generated proto types
RUN npm run generate:proto && npx tsc --noEmit -p apps/${APP}/tsconfig.app.json && npx nest build ${APP}

FROM node:24-slim AS runtime
ARG APP
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist/apps/${APP} ./dist
COPY proto ./proto
# owned by node, so a named volume mounted here inherits the owner
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["node", "dist/main.js"]
