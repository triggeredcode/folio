FROM node:20-slim AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ENV NEXT_PUBLIC_API_URL=http://localhost:8000
RUN pnpm build

FROM node:20-slim AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
