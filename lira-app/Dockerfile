# The hosted edition as a small web container: the built public pages and the app under /app, served by nginx.
# Build from this folder:  az acr build --registry <name> --image liraspaces-web:v1 .   (or docker build)
# Nothing from data/ or any secret is copied in: the build only reads the source, and only the built pages are kept.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx tsc -b && npx vite build --mode hosted

# The unprivileged nginx image runs as a normal user and listens on 8080, so the container needs no extra rights.
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
