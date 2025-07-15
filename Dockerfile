# Use Node.js 18 as the base image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the source code
COPY src/ ./src/

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S bot -u 1001

# Change ownership of the app directory to the bot user
RUN chown -R bot:nodejs /app
USER bot

# Expose the port for the keep-alive server
EXPOSE 3000

# Start the bot
CMD ["node", "src/app.js"] 