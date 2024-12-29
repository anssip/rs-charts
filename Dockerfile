FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json .
COPY bun.lockb .

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Set build argument
ARG API_BASE_URL
ENV API_BASE_URL=$API_BASE_URL

# Build the application with the environment variable
RUN API_BASE_URL=$API_BASE_URL bun run build

# Expose the port your server listens on
ENV PORT=8080
EXPOSE 8080

# Make sure the start command is explicit
CMD ["bun", "./dist/server/index.js"] 