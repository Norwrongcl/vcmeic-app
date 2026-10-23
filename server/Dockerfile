FROM node:24-bookworm-slim AS verification
ARG VCM_SOURCE_SHA=local
LABEL org.vcmeic.source-sha=$VCM_SOURCE_SHA
RUN npm install --global pnpm@11.25.0
WORKDIR /app/server
COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN ln -s /app/server/node_modules /app/node_modules
COPY server /app/server
COPY packages/domain /app/packages/domain
COPY database /app/database
RUN pnpm build
CMD ["node", "--experimental-strip-types", "scripts/verify-vps.ts"]

FROM node:24-bookworm-slim AS runtime
ARG VCM_SOURCE_SHA=local
LABEL org.vcmeic.source-sha=$VCM_SOURCE_SHA
RUN npm install --global pnpm@11.25.0
WORKDIR /app/server
COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=verification /app/server/dist ./dist
COPY --from=verification /app/database/migrations /app/database/migrations
ENV NODE_ENV=production TZ=America/Santiago NODE_OPTIONS=--max-old-space-size=256
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server/src/main.js"]
