# Image de production du site (contexte de construction : racine du dépôt).
#   docker build -f web/Dockerfile -t visa-web .
FROM node:22-alpine AS base
WORKDIR /app
# pnpm téléchargé une fois (version de « packageManager »), partagé par les images.
COPY package.json ./
RUN corepack enable && corepack install
ENV CI=1 NEXT_TELEMETRY_DISABLED=1

FROM base AS construction
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
COPY extension/package.json extension/
RUN pnpm install --frozen-lockfile --filter @visa/web...
COPY web/ web/
# « build » copie aussi le moteur de lecture du passeport dans public/ocr.
RUN pnpm --filter @visa/web build

# Serveur autonome de Next (output: 'standalone') : seulement les fichiers utiles.
FROM node:22-alpine AS execution
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3002 HOSTNAME=0.0.0.0
COPY --from=construction --chown=node:node /app/web/.next/standalone ./
COPY --from=construction --chown=node:node /app/web/.next/static ./web/.next/static
COPY --from=construction --chown=node:node /app/web/public ./web/public
USER node
EXPOSE 3002
CMD ["node", "web/server.js"]
