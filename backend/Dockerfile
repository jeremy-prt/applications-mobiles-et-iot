# syntax=docker/dockerfile:1

# L'image de base est figée par son empreinte sha256, pas seulement par son tag.
# Un tag peut être republié avec un contenu différent : l'empreinte garantit que
# la même construction donnera le même résultat dans six mois.
# Aucune clé platform : l'image est multi-architecture, Docker prend la bonne
# variante sur Mac arm64 comme sur Windows amd64.
ARG NODE_IMAGE=node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci installe exactement ce que décrit package-lock.json, et refuse de
# démarrer si le fichier a dérivé du package.json.
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx tsc -p tsconfig.build.json

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY migrations ./migrations

# Les dépendances sont installées dans l'image, jamais copiées depuis la
# machine : un binaire natif compilé pour macOS ne fonctionnerait pas ici.
RUN chown -R node:node /app

# L'image node fournit déjà un utilisateur non privilégié. Tourner en root
# dans un conteneur donne les droits root sur les fichiers montés.
USER node

EXPOSE 3000

# Utilisé par Compose pour savoir si le service répond vraiment, et pas
# seulement s'il a démarré.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# init:true dans le Compose fournit le processus 1 qui transmet les signaux,
# ce qui permet un arrêt propre sur SIGTERM.
CMD ["node", "dist/server.js"]
