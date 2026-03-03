FROM node:22-alpine AS builder
WORKDIR /app
# Passed from docker-compose so rewrites() bakes the correct URL at build time
ARG BACKEND_INTERNAL_URL=http://backend:4000
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}
# Socket.IO connects from the browser directly to the backend port (not via Next.js proxy).
# Browser always sees backend as localhost:4000 since the port is published to the host.
ARG NEXT_PUBLIC_BACKEND_SOCKET_URL=http://localhost:4000
ENV NEXT_PUBLIC_BACKEND_SOCKET_URL=${NEXT_PUBLIC_BACKEND_SOCKET_URL}
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
