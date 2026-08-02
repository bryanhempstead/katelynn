# Dockerfile for a Medusa v2 server, used by docker-compose.yml in this
# directory. There is NO official all-in-one Medusa server image, so this is
# the documented two-step: you scaffold the app locally with
#
#   npx create-medusa-app@latest app
#
# (run inside this medusa/ directory, producing medusa/app/), and this
# Dockerfile builds THAT app. See docs/MEDUSA.md for the full walkthrough.
#
# Build context is the medusa/ directory (see docker-compose.yml), so paths
# below are relative to medusa/, and the scaffolded app lives at ./app.

# ---- Stage 1: build ---------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /src

# Install dependencies first so Docker layer-caches them across code changes.
COPY app/package.json app/package-lock.json* ./
RUN npm install

# Copy the rest of the scaffolded app and run Medusa's production build.
# `medusa build` outputs a standalone server bundle to .medusa/server
# (this is Medusa v2's documented deployment artifact).
COPY app/ ./
RUN npx medusa build

# ---- Stage 2: runtime -------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /srv
ENV NODE_ENV=production \
    PORT=9000

# The built server bundle ships its own package.json; install its (pruned)
# production dependencies — this is the step Medusa's deployment docs call
# "npm install inside .medusa/server".
COPY --from=build /src/.medusa/server ./
RUN npm install --omit=dev && npm cache clean --force

EXPOSE 9000

# On every start: apply pending database migrations, then start the server.
# Running migrations at boot keeps postgres in sync after image upgrades;
# for multi-instance deployments move `db:migrate` to a one-off job instead.
CMD ["sh", "-c", "npx medusa db:migrate && npm run start"]
