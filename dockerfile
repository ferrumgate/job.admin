FROM node:16.13.2-bullseye-slim
RUN apt update &&\
    apt install --assume-yes --no-install-recommends iproute2 \
    iptables iputils-ping net-tools ipvsadm dnsutils iperf3 \
    ca-certificates gnupg curl nginx tcpdump procps
RUN  apt install --assume-yes --no-install-recommends podman fuse-overlayfs
VOLUME /var/lib/containers
ADD https://raw.githubusercontent.com/containers/libpod/master/contrib/podmanimage/stable/containers.conf /etc/containers/containers.conf
RUN chmod 644 /etc/containers/containers.conf; 
RUN touch /etc/containers/storage.conf
RUN echo "[storage]" > /etc/containers/storage.conf
RUN echo "driver = \"overlay\"" >> /etc/containers/storage.conf
RUN echo "[storage.options]" >> /etc/containers/storage.conf
RUN echo "mount_program = \"/usr/bin/fuse-overlayfs\""  >> /etc/containers/storage.conf
RUN sed -i -e 's|^#mount_program|mount_program|g' -e '/additionalimage.*/a "/var/lib/shared",' -e 's|^mountopt[[:space:]]*=.*$|mountopt = "nodev,fsync=0"|g' /etc/containers/storage.conf
RUN mkdir -p /var/lib/shared/overlay-images /var/lib/shared/overlay-layers /var/lib/shared/vfs-images /var/lib/shared/vfs-layers; touch /var/lib/shared/overlay-images/images.lock; touch /var/lib/shared/overlay-layers/layers.lock; touch /var/lib/shared/vfs-images/images.lock; touch /var/lib/shared/vfs-layers/layers.lock
ENV _CONTAINERS_USERNS_CONFIGURED=""
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