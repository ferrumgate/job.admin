#!/bin/bash

set -e
first="$1"
second="$2"
npm run build
rm -rf node_modules/rest.portal2
mkdir -p node_modules/rest.portal2
cp -R node_modules/rest.portal/* node_modules/rest.portal2
version=$(cat package.json | grep version | cut -d: -f2 | tr -d , | tr -d \" | tr -d " ")
docker build -t job.admin .
docker tag job.admin "job.admin:$version"
echo "job.admin:$version builded"
docker tag job.admin "registry.ferrumgate.zero/ferrumgate/job.admin:$version"
docker tag job.admin registry.ferrumgate.zero/ferrumgate/job.admin:latest
docker tag job.admin "ferrumgate/job.admin:$version"

execute() {
    docker push registry.ferrumgate.zero/ferrumgate/job.admin:"$version"
    docker push registry.ferrumgate.zero/ferrumgate/job.admin:latest
    if [ "$first" == "--push" ] || [ "$second" == "--push" ]; then
        docker push ferrumgate/job.admin:"$version"
    fi

}

if [ "$first" == "--force" ] || [ "$second" == "--force" ]; then
    execute
    exit
else
    while true; do
        read -r -p "do you want push to local registry y/n " yn
        case $yn in
        [Yy]*)
            execute
            break
            ;;
        [Nn]*) exit ;;
        *) echo "please answer yes or no." ;;
        esac
    done
fi
