FROM node:16.14.2

WORKDIR /app

COPY ./logger /app/logger
COPY ./shared /app/shared

RUN cd /app/shared && \
    npm ci && \
    cd ../logger && \
    npm ci

WORKDIR /app/logger

CMD npm run serve
