FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Remove the hardcoded localhost default. 
# This variable must be provided in your platform's Environment Variables settings.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Before starting nginx, we use 'sed' to dynamically swap out 'listen 80;' 
# inside your default.conf to match whatever port the hosting platform assigns.
CMD ["sh", "-c", "sed -i 's/listen 80;/listen '\"$PORT\"';/' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]