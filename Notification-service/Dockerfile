FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install tzdata for timezone support
RUN apk add --no-cache tzdata

RUN npm install

# Copy source code
COPY . .

# Expose port (Notification service usually runs on 3001 or similar, check config)
EXPOSE 3001

# Start command
CMD ["npm", "run", "dev"]
# For production use: CMD ["node", "src/index.js"]
