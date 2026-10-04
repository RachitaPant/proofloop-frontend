# Build from the repository root (the API depends on packages/shared):
#   docker build -f apps/api/Dockerfile -t proofloop-api .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @proofloop/api build
# Self-contained production install of just the API's runtime dependencies.
RUN pnpm --filter @proofloop/api deploy --prod --legacy /out \
  && cp -r apps/api/dist /out/dist

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
