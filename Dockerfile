FROM node:18

# Install dependencies in a clean layer using package-lock for reproducible installs
WORKDIR /usr/src/app/server
COPY server/package*.json ./
RUN npm install --production --no-audit --no-fund

# Copy the rest of the server files
COPY server/ ./

EXPOSE 4242
ENV PORT=4242
CMD ["node", "index.js"]

