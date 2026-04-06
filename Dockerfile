FROM gcr.io/distroless/nodejs24-debian12 AS runner
FROM node:24-slim AS base

# --------> The build image
FROM base AS build

WORKDIR /usr/src/app
COPY . .

ENV NODE_ENV=production
RUN yarn install
RUN yarn build

# --------> The production image
FROM runner AS release
WORKDIR /app
COPY --from=build /usr/src/app/.output .

ENV NODE_ENV=production
CMD ["server/index.mjs"]

# --------> The development image
FROM base AS dev

WORKDIR /usr/src/app

COPY .yarn/ ./.yarn/
COPY .yarnrc.yml .
COPY package.json .
COPY yarn.lock .

RUN yarn install
CMD ["yarn", "dev"]

# docker build . --build-arg="TURNSTILE_KEY=1x00000000000000000000AA,TURNSTILE_SECRET=1x0000000000000000000000000000000AA" -t acs:front 
