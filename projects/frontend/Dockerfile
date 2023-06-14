FROM node:16.14.2 AS build-stage

# requires indirection using arguments since environment variables are not available during build stage
ARG WODSS_ENV=docker
ARG WODSS_REVISION=-
ARG WODSS_YJS_VERSION=1
ARG WODSS_MQTT_USERNAME=user
ARG WODSS_MQTT_HOST=localhost
ARG WODSS_MQTT_PORT=9001
ARG WODSS_MQTT_PROTOCOL=ws
ARG WODSS_MQTT_PATH=/
ARG WODSS_MQTT_MIN_LATENCY=0
ARG WODSS_MQTT_MAX_LATENCY=0

WORKDIR /app/build

COPY ./frontend/package*.json ./
COPY ./shared /app/shared

RUN cd /app/shared && \
    npm ci && \
    cd ../build && \
    npm ci

COPY ./frontend .

RUN npm run build:prod

FROM nginx AS production-stage

EXPOSE 18080

COPY --from=build-stage /app/build/dist /app
COPY ./frontend/docker/nginx.conf /etc/nginx/nginx.conf
