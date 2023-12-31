#!/bin/bash

env=$1
path="./config/$env/.env"
disclaimer="# THIS FILE IS GENERATED BY ./setup.sh $env"

printVariableDeclaration() {
    prefix=$([[ "$1" == '-' ]] && echo '' || echo "$1")
    name="$2$3$4$5"
    value=$(printenv $name)
    echo "$prefix$2$6$4=$value"
}

printAllVariables() {
    infix="_$2"

    printVariableDeclaration $1 'WODSS_ENV'
    printVariableDeclaration $1 'WODSS_REVISION'
    printVariableDeclaration $1 'WODSS_YJS_VERSION'
    printVariableDeclaration $1 'WODSS' '_MOSQUITTO' '_USERNAME' $infix '_MQTT'
    printVariableDeclaration $1 'WODSS' '_MOSQUITTO' '_PASSWORD' $infix '_MQTT'
    printVariableDeclaration $1 'WODSS' $infix '_MQTT_HOST'
    printVariableDeclaration $1 'WODSS' $infix '_MQTT_PORT'
    printVariableDeclaration $1 'WODSS' $infix '_MQTT_PROTOCOL'
    printVariableDeclaration $1 'WODSS' $infix '_MQTT_PATH'
    printVariableDeclaration $1 'WODSS' $infix '_MQTT_MIN_LATENCY'
    printVariableDeclaration $1 'WODSS' $infix '_MQTT_MAX_LATENCY'

    printVariableDeclaration $1 'WODSS_MQTT_COMPRESSION_THRESHOLD'
    printVariableDeclaration $1 'WODSS_MQTT_COMPRESSION_LEVEL'

    printVariableDeclaration $1 'WODSS_SYNC_STORE_DEBOUNCE'
    printVariableDeclaration $1 'WODSS_SYNC_STORE_MQTT_QOS'

    printVariableDeclaration $1 'WODSS' $infix '_MONGODB_HOST'
    printVariableDeclaration $1 'WODSS_MONGODB_PORT'
    printVariableDeclaration $1 'WODSS_MONGODB_USERNAME'
    printVariableDeclaration $1 'WODSS_MONGODB_PASSWORD'
    printVariableDeclaration $1 'WODSS_MONGODB_DATABASE'
}

distributeLogs() {
    component=$1
    path="./config/$env/logs/$component.json"
    envFile="./$component/.env"
    outJsonFile="./$component/log.json"

    export $(grep -v '^#' $envFile | xargs) && cat $path | \
    sed 's@${WODSS_MQTT_PROTOCOL}@'"$(printenv "$2WODSS_MQTT_PROTOCOL")"'@' | \
    sed 's@${WODSS_MQTT_HOST}@'"$(printenv "$2WODSS_MQTT_HOST")"'@' | \
    sed 's@${WODSS_MQTT_PORT}@'"$(printenv "$2WODSS_MQTT_PORT")"'@' | \
    sed 's@${WODSS_MQTT_PATH}@'"$(printenv "$2WODSS_MQTT_PATH")"'@' | \
    sed 's@${WODSS_LOGGER_MQTT_TOPIC}@'"$(printenv "$2WODSS_LOGGER_MQTT_TOPIC")"'@' | \
    sed 's@${WODSS_LOGGER_PATH}@'"$(printenv "$2WODSS_LOGGER_PATH")"'@' \
    > $outJsonFile
}

if [[ -z "$env" ]]; then
    >&2 echo "pass the environment as first argument to this script e.g. ./setup.sh local"

    exit 1
fi

if [[ ! -f "$path" ]]; then
    >&2 echo "the file $path does not exist"

    exit 2
fi

# import variables
export $(grep -v '^#' $path | xargs)

# define additional vars
export WODSS_ENV=$env
export WODSS_REVISION=$([ -z "$GITHUB_SHA" ] && git rev-parse --short HEAD || git rev-parse --short "$GITHUB_SHA")

if [[ -z $(echo $@ | grep -e '--no-env') ]]; then
    # backend
    cd ./backend

    echo "$disclaimer" > .env
    printAllVariables '-' 'BACKEND' >> .env

    echo "[env] backend    OK"

    # mongodb
    cd ../mongodb

    echo "$disclaimer" > .env
    echo "WODSS_ENV=$WODSS_ENV" >> .env
    printenv | grep 'WODSS_MONGODB_' >> .env

    echo "[env] mongodb    OK"

    # logger
    cd ../logger

    echo "$disclaimer" > .env
    echo "WODSS_ENV=$WODSS_ENV" >> .env
    echo "WODSS_MQTT_USERNAME=$WODSS_MOSQUITTO_USERNAME_MONITOR" >> .env
    echo "WODSS_MQTT_PASSWORD=$WODSS_MOSQUITTO_PASSWORD_MONITOR" >> .env
    echo "WODSS_MQTT_HOST=$WODSS_LOGGER_MQTT_HOST" >> .env
    echo "WODSS_MQTT_PORT=$WODSS_LOGGER_MQTT_PORT" >> .env
    echo "WODSS_MQTT_PROTOCOL=$WODSS_LOGGER_MQTT_PROTOCOL" >> .env
    echo "WODSS_MQTT_PATH=$WODSS_LOGGER_MQTT_PATH" >> .env
    echo "WODSS_LOGGER_MQTT_TOPIC=$WODSS_LOGGER_MQTT_TOPIC" >> .env
    echo "WODSS_LOGGER_PATH=$WODSS_LOGGER_PATH" >> .env

    echo "[env] logger     OK"

    # frontend
    cd ../frontend

    echo "$disclaimer" > .env
    printAllVariables 'VUE_APP_' 'FRONTEND' | grep -v '_MONGODB_' >> .env
    echo "VUE_APP_WODSS_LOGGER_MQTT_TOPIC=$WODSS_LOGGER_MQTT_TOPIC" >> .env

    echo "[env] frontend   OK"

    # mosquitto
    cd ../mosquitto

    echo "$disclaimer" > .env
    echo "WODSS_ENV=$WODSS_ENV" >> .env
    printenv | grep 'WODSS_MOSQUITTO_' >> .env

    echo "[env] mosquitto  OK"

    # shared
    cd ../shared

    echo "$disclaimer" > .env
    printAllVariables '-' 'BACKEND' >> .env

    echo "[env] shared     OK"

    cd ..
fi

# distribute log configs
if [[ -z $(echo $@ | grep -e '--no-log') ]]; then
    # backend
    distributeLogs 'backend'

    echo "[log] backend    OK"

    # logger
    distributeLogs 'logger'

    echo "[log] logger     OK"

    # frontend
    distributeLogs 'frontend' 'VUE_APP_'

    echo "[log] frontend   OK"
fi

# final check
echo "WODSS_ENV=$env" > .env

# done

exit $result
