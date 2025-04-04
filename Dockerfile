FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Install needed build tools for native modules (like mssql)
RUN apk add --no-cache python3 make g++ \
  && npm install express mssql cors \
  && apk del python3 make g++  # clean up after install

# Copy your server file
COPY server.js .

# Expose your app's port
EXPOSE 4000

# Start the app
CMD ["node", "server.js"]