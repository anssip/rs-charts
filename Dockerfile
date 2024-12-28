FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json .
COPY bun.lockb .

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Expose the port your server listens on
ENV PORT=8080
EXPOSE 8080

# Start the server
CMD ["bun", "run", "start"] 