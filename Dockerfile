FROM oven/bun:canary-alpine

WORKDIR /app
COPY . .

RUN apk update && apk add imagemagick ghostscript
RUN bun --bun install
RUN bun --bun run build

CMD ["bun", "./build/index.js"]