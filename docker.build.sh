#!/bin/bash

set -e
npm run build
version=$(cat package.json | grep version | cut -d: -f2 | tr -d , | tr -d \" | tr -d " ")
docker build -t job.admin .
docker tag job.admin job.admin:$version
echo "job.admin:$version builded"
docker tag job.admin registry.ferrumgate.local/ferrumgate/job.admin:$version
docker tag job.admin registry.ferrumgate.local/ferrumgate/job.admin:latest
