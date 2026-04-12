# Use official Playwright image with all browser dependencies
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

# Set working directory
WORKDIR /app

# Install Node.js dependencies first (for caching)
COPY pipeline/package*.json ./pipeline/
WORKDIR /app/pipeline
RUN npm ci --production

# Copy pipeline code
COPY pipeline/ ./

# Copy other necessary files
WORKDIR /app
COPY scripts/ ./scripts/
COPY message-template.txt ./
COPY campaign.config.example.json ./

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV NODE_OPTIONS=--max-old-space-size=4096

# Create data directory for SQLite (will be mounted as volume)
RUN mkdir -p /app/data

# Run the pipeline
WORKDIR /app/pipeline
CMD ["node", "index.js"]
