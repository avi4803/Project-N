FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (including bcrypt build tools if needed, but alpine usually needs python3 make g++)
# If simple install fails, uncomment the apk add line
# RUN apk add --no-cache python3 make g++

RUN npm install

# Copy source code
COPY . .

# Expose port (ensure this matches process.env.PORT)
EXPOSE 3000

# Start command
CMD ["npm", "run", "dev"] 
# For production use: CMD ["node", "src/index.js"]
