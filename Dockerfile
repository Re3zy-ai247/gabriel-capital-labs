FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS deps
WORKDIR /app
RUN apk add --no-cache openssl=3.5.8-r0
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS runner
WORKDIR /app
RUN apk add --no-cache openssl=3.5.8-r0
ENV NODE_ENV=production
COPY --from=deps /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
