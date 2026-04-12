# Email Pipeline - No browser automation, lightweight deployment
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install Node.js dependencies first (for caching)
COPY pipeline/package*.json ./pipeline/
WORKDIR /app/pipeline
RUN npm ci --production

# Copy only email pipeline code (no FB scraping, no Playwright)
COPY pipeline/email-pipeline.js ./
COPY pipeline/db.js ./
COPY pipeline/config.js ./
COPY pipeline/google/ ./google/
COPY pipeline/llm/ ./llm/
COPY pipeline/templates/ ./templates/
COPY pipeline/jobs/detect-signups.js ./jobs/
COPY pipeline/jobs/schedule.js ./jobs/
COPY pipeline/jobs/remind.js ./jobs/
COPY pipeline/jobs/followup.js ./jobs/

# Set environment variables
ENV NODE_ENV=production

# Create data directory for SQLite (will be mounted as volume)
RUN mkdir -p /app/data

# Run the email pipeline only
WORKDIR /app/pipeline
CMD ["node", "email-pipeline.js"]
