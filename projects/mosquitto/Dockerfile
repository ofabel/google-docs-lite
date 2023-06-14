FROM eclipse-mosquitto:2

# requires indirection using arguments since environment variables are not available during build stage
ARG WODSS_MOSQUITTO_PORT_MQTT=1883
ARG WODSS_MOSQUITTO_PORT_WS=9001

EXPOSE $WODSS_MOSQUITTO_PORT_MQTT
EXPOSE $WODSS_MOSQUITTO_PORT_WS

COPY .env docker/*.conf /mosquitto/config/

RUN export $(grep -v '^#' /mosquitto/config/.env | xargs) && \
    echo "$WODSS_MOSQUITTO_USERNAME_BACKEND:$WODSS_MOSQUITTO_PASSWORD_BACKEND" > /mosquitto/config/users.conf && \
    echo "$WODSS_MOSQUITTO_USERNAME_FRONTEND:$WODSS_MOSQUITTO_PASSWORD_FRONTEND" >> /mosquitto/config/users.conf && \
    echo "$WODSS_MOSQUITTO_USERNAME_MONITOR:$WODSS_MOSQUITTO_PASSWORD_MONITOR" >> /mosquitto/config/users.conf && \
    echo "$WODSS_MOSQUITTO_USERNAME_ADMIN:$WODSS_MOSQUITTO_PASSWORD_ADMIN" >> /mosquitto/config/users.conf && \
    mosquitto_passwd -U /mosquitto/config/users.conf && \
    mv /mosquitto/config/mosquitto.conf /mosquitto/config/mosquitto.conf.temp && \
    mv /mosquitto/config/acl.conf /mosquitto/config/acl.conf.temp && \
    cat /mosquitto/config/mosquitto.conf.temp | sed 's@{{WS_PORT}}@'"$WODSS_MOSQUITTO_PORT_WS"'@' | sed 's@{{MQTT_PORT}}@'"$WODSS_MOSQUITTO_PORT_MQTT"'@' > /mosquitto/config/mosquitto.conf && \
    cat /mosquitto/config/acl.conf.temp | sed 's@{{USER_BACKEND}}@'"$WODSS_MOSQUITTO_USERNAME_BACKEND"'@' | sed 's@{{USER_FRONTEND}}@'"$WODSS_MOSQUITTO_USERNAME_FRONTEND"'@' | sed 's@{{USER_MONITOR}}@'"$WODSS_MOSQUITTO_USERNAME_MONITOR"'@' | sed 's@{{USER_ADMIN}}@'"$WODSS_MOSQUITTO_USERNAME_ADMIN"'@' > /mosquitto/config/acl.conf && \
    rm /mosquitto/config/mosquitto.conf.temp /mosquitto/config/acl.conf.temp /mosquitto/config/.env
