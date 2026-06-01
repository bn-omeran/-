# ==========================================
# Phase 1: Build Phase
# ==========================================
FROM node:20-alpine AS build-stage

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install design and development dependencies
RUN npm ci

# Copy the entire source code and config files
COPY . .

# Build the client SPA for production
RUN npm run build

# ==========================================
# Phase 2: Production Serving Phase (Nginx)
# ==========================================
FROM nginx:alpine AS production-stage

# Copy a lightweight custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from Phase 1 build output
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Expose port 8080 to match the container's internal listening port
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
