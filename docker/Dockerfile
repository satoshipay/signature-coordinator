ARG BUILDER=node:10-alpine
ARG RUNNER=node:10-alpine

## Builder
FROM $BUILDER as builder
WORKDIR /app

ARG BUILD_HASH
ARG NODE_ENV=development

# Install deps
COPY package.json package-lock.json ./
RUN npm install --silent

# Copy source
COPY tsconfig.json ./
COPY src ./src
COPY test ./test

# Build
RUN npm run build

# Saving some info about the build
RUN echo $BUILD_HASH > /app/.version

# Remove non-production dependencies
RUN npm prune --production

## Runner

FROM $RUNNER
WORKDIR /app

ENV NODE_ENV production
ENV PORT 3000

COPY --from=builder /app/package.json /app/package-lock.json /app/.version /app/
COPY --from=builder /app/build /app/build
COPY --from=builder /app/node_modules /app/node_modules

EXPOSE 3000

CMD "node" "./build/index.js"
