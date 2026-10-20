# React build served by Caddy, which also proxies /api to the backend and
# gets the HTTPS certificate (see deploy/Caddyfile).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The API is on the same site under /api; Google Sign-In needs its client ID at build time.
ARG REACT_APP_GOOGLE_CLIENT_ID=
ENV REACT_APP_API_BASE=/api \
    REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/build /srv
