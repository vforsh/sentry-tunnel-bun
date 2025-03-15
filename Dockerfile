FROM oven/bun:1.2.2

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE $PORT

CMD ["bun", "start"]