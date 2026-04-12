# Email Pipeline - No browser automation, lightweight deployment
FROM node:20-slim

# Set working directory
WORKDIR /app/pipeline

# Copy package files
COPY pipeline/package*.json ./

# Install dependencies
RUN npm ci --production

# Copy all pipeline code (FB scraping files excluded via .dockerignore)
COPY pipeline/ ./

# Set environment variables
ENV NODE_ENV=production

# Create data directory for SQLite (will be mounted as volume)
RUN mkdir -p /app/data

# Run the email pipeline only
CMD ["node", "email-pipeline.js"]
