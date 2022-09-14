FROM node:16.13.2-bullseye-slim
RUN apt update &&\
    apt install --assume-yes --no-install-recommends iproute2 iptables iputils-ping net-tools podman ipvsadm dnsutils iperf3 nc
#Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json /usr/src/app/

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

ADD build/src /usr/src/app/build/src
WORKDIR /usr/src/app
EXPOSE 9050
ENTRYPOINT ["npm","run","startdocker"]