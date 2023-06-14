#!/bin/bash

mode=$([ "$1" == "ci" ] && echo "ci" || echo "install")

# install the shared library dependencies
cd shared && \

npm $mode && \

# install the logger application dependencies
cd ../logger && \

npm $mode && \


# install the backend application dependencies
cd ../backend && \

npm $mode && \

# install the frontend application dependencies
cd ../frontend && \

npm $mode

# done
exit $?
