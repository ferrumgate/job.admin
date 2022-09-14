#!/bin/bash
### prepare env for test
### start a redis server on host
set +e
docker stop redis
set -e
docker run --net=host --name redis --rm -d redis
