FROM docker.io/oven/bun:alpine AS builder

WORKDIR /app
COPY . .

RUN bun install
RUN bun run build

FROM docker.io/oven/bun:alpine

WORKDIR /app
COPY --from=builder /app/build .

RUN apk update && apk add imagemagick ghostscript

CMD ["bun", "index.js"]
