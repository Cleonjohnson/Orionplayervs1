FROM node:18-alpine
WORKDIR /usr/src/app
COPY server/package.json server/package-lock.json* ./server/
RUN apk add --no-cache git curl build-base python3 && cd server && npm install --production
COPY server ./server
WORKDIR /usr/src/app/server
EXPOSE 4242
ENV PORT=4242
CMD ["node", "index.js"]

