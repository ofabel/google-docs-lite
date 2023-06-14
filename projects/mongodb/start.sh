#!/bin/bash

if [[ ! -f "./.env" ]]; then
    >&2 echo "the file ./.env does not exist"

    exit 2
fi

export $(grep -v '^#' ./.env | xargs)

name="wodss-mongodb"$([ "$WODSS_ENV" == "test" ] && echo "-test" || echo "")

# stop and remove any running instance
docker ps | grep $name && docker stop $name
docker rm $name > /dev/null 2>&1

# build the docker image with the necessary build arguments
docker build \
    . \
    -t $name && \

# start the docker container in the background
docker run \
    --detach \
    --hostname=$name \
    --name=$name \
    --publish=$WODSS_MONGODB_PORT:27017 \
    --env-file ./.env \
    $name

# done
exit $?
