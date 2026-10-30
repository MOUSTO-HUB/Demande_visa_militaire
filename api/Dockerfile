# Image de production de l'API (contexte de construction : racine du dépôt).
#   docker build -f api/Dockerfile -t visa-api .
FROM node:22-alpine AS base
WORKDIR /app
# pnpm téléchargé une fois (version de « packageManager »), partagé par les images.
COPY package.json ./
RUN corepack enable && corepack install
ENV CI=1

FROM base AS construction
# Manifestes d'abord : le cache Docker garde les dépendances tant qu'ils ne changent pas.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
COPY extension/package.json extension/
# Le schéma est nécessaire au postinstall (prisma generate).
COPY api/prisma api/prisma
COPY api/prisma7.config.ts api/
RUN pnpm install --frozen-lockfile --filter @visa/api...
COPY api/ api/
RUN pnpm --filter @visa/api exec prisma generate --config prisma7.config.ts \
 && pnpm --filter @visa/api build

FROM base AS execution
ENV NODE_ENV=production \
    API_PORT=3200 \
    STOCKAGE_DIR=/donnees/stockage
COPY --from=construction --chown=node:node /app /app
RUN mkdir -p /donnees/stockage && chown -R node:node /donnees
WORKDIR /app/api
USER node
EXPOSE 3200
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3200/api/sante >/dev/null || exit 1
# Migrations en attente appliquées à chaque démarrage, puis l'API.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy --config prisma7.config.ts && exec node dist/main.js"]
