FROM node:16.14.2

WORKDIR /app

COPY ./backend /app/backend
COPY ./shared /app/shared

RUN cd /app/shared && \
    npm ci && \
    cd ../backend && \
    npm ci

WORKDIR /app/backend

CMD npm run serve