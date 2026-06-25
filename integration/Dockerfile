FROM node:20-slim

# Install git and other utilities if needed by MCP servers
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the integration workspace
COPY package*.json ./
RUN npm install

COPY . .

# Build TypeScript
RUN npm run build

# Hugging Face Spaces expect apps to run on port 7860
EXPOSE 7860
ENV INTEGRATION_PORT=7860

# Start the server
CMD ["npm", "start"]
