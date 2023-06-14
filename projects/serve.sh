#!/bin/bash

env=$1
envFile="./config/$env/.env"

noCache=$([[ "$2" == '--force' ]] && echo '--no-cache' || echo "")
forceRecreate=$([[ "$2" == '--force' ]] && echo '--force-recreate' || echo "")

if [[ -z "$env" ]]; then
    >&2 echo "environment is missing, pass as first argument to this script"

    exit 2
fi

# check if env file exists
if [[ ! -f "$envFile" ]]; then
    >&2 echo "the file env file at $envFile does not exist"

    exit 2
fi

# store initial env
initialEnv=$env
if [[ -f "./.env" ]]; then
    export $(grep -v '^#' ./.env | xargs)

    initialEnv=$WODSS_ENV
fi

# distribute env and log configs
./setup.sh $env

# build the docker images
docker-compose --project-name=wodss --env-file=$envFile build $noCache && \

# finally run the docker containers
docker-compose --project-name=wodss --env-file=$envFile up --detach $forceRecreate

result=$?

# reset initial env and log configs
./setup.sh $initialEnv

# done
exit $result
