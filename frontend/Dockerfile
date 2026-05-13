# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
ENV CI=true GENERATE_SOURCEMAP=false

COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile --network-timeout 600000 || yarn install --network-timeout 600000

COPY . .
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}
RUN yarn build

# --- runtime stage ---
FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
RUN cat > /etc/nginx/conf.d/default.conf <<'NGINX'
server {
  listen 3000;
  server_name _;
  client_max_body_size 25m;

  location /api/ {
    proxy_pass http://panel-backend:8001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
  }

  root /usr/share/nginx/html;
  index index.html;
  location / { try_files $uri /index.html; }
  location ~* \.(?:js|css|svg|woff2?|ttf|png|jpg|jpeg|gif|ico)$ {
    add_header Cache-Control "public, max-age=604800, immutable";
  }
}
NGINX

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
