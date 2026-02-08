# Build Stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Install production dependencies only (for smaller image)
# Using 'npm install' instead of 'npm ci' to ensure nodemailer is installed if lockfile is out of sync
RUN npm install --omit=dev

# Runtime Stage
FROM node:18-alpine
WORKDIR /app

# Install tzdata for timezone support (Crucial for Attendance IST)
RUN apk add --no-cache tzdata
ENV TZ=Asia/Kolkata

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Expose port (Matches .env PORT)
EXPOSE 3000

# Start command
CMD ["npm", "start"]
