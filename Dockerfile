FROM node:25.3.0-alpine

# Install Docker CLI and Docker Compose plugin
# We need these to execute docker commands from the slave
RUN apk add --no-cache docker-cli docker-cli-compose

WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Make the CLI executable
RUN chmod +x bin/index.js

# Expose the default port
EXPOSE 3000

# Start the server listener by default
CMD ["node", "bin/index.js", "listen"]
