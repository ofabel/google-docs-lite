#!/bin/bash
mongo --eval "db = db.getSiblingDB('$WODSS_MONGODB_DATABASE'); db.createUser({ user: '$WODSS_MONGODB_USERNAME', pwd: '$WODSS_MONGODB_PASSWORD', roles: [{ role: 'readWrite', db: '$WODSS_MONGODB_DATABASE' }] });"
