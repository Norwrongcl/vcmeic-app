FROM node:24-bookworm-slim
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY src ./src
COPY tests ./tests
COPY migrations ./migrations
COPY catalog ./catalog
COPY bootstrap.sql tsconfig.json vitest.config.ts ./
# Ephemeral CLI/test tool, no listening service and no application credentials.
USER node
CMD ["node", "--experimental-strip-types", "src/cli.ts"]
