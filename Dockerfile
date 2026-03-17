FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .
RUN LOGWIZ_QUICKWIT_URL=http://placeholder:7280/api/v1 \
    ORIGIN=http://placeholder:3000 \
    bun run build

FROM oven/bun:1

WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts --production

EXPOSE 3000

CMD ["bun", "run", "./build/index.js"]
