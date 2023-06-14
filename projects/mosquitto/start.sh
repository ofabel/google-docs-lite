#!/bin/bash

if [[ ! -f "./.env" ]]; then
    >&2 echo "the file ./.env does not exist"

    exit 2
fi

export $(grep -v '^#' ./.env | xargs)

name="wodss-mosquitto"$([ "$WODSS_ENV" == "test" ] && echo "-test" || echo "")

# stop and remove any running instance
docker ps | grep $name && docker stop $name
docker rm $name > /dev/null 2>&1

# build the docker image with the necessary build arguments
docker build \
    --build-arg WODSS_MOSQUITTO_PORT_MQTT="${WODSS_MOSQUITTO_PORT_MQTT}" \
    --build-arg WODSS_MOSQUITTO_PORT_WS="${WODSS_MOSQUITTO_PORT_WS}" \
    . \
    -t $name && \

# start the docker container in the background
docker run \
    --detach \
    --hostname=$WODSS_MQTT_HOST \
    --name=$name \
    --publish=$WODSS_MOSQUITTO_PORT_MQTT:$WODSS_MOSQUITTO_PORT_MQTT \
    --publish=$WODSS_MOSQUITTO_PORT_WS:$WODSS_MOSQUITTO_PORT_WS \
    $name

# done
exit $?
