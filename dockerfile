FROM node:18.13.0-bullseye-slim
RUN apt update &&\
    apt install --assume-yes --no-install-recommends iproute2 openssl \
    iputils-ping net-tools ipvsadm dnsutils iperf3 \
    ca-certificates gnupg curl tcpdump procps conntrack lsb-release
RUN sed -i 's/providers = provider_sect/#providers = provider_sect/g' /etc/ssl/openssl.cnf
#RUN  apt install --assume-yes --no-install-recommends podman fuse-overlayfs
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
RUN echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
    $(lsb_release -cs) stable" |  tee /etc/apt/sources.list.d/docker.list > /dev/null
RUN apt update
RUN apt-get install --assume-yes --no-install-recommends docker-ce docker-ce-cli containerd.io docker-compose-plugin
#VOLUME /var/lib/containers
#VOLUME /home/podman/.local/share/containers
#ADD https://raw.githubusercontent.com/containers/libpod/master/contrib/podmanimage/stable/containers.conf /etc/containers/containers.conf
#RUN chmod 644 /etc/containers/containers.conf; 
#RUN touch /etc/containers/storage.conf
#RUN echo "[storage]" > /etc/containers/storage.conf
#RUN echo "driver = \"overlay\"" >> /etc/containers/storage.conf
#RUN echo "[storage.options]" >> /etc/containers/storage.conf
#RUN echo "mount_program = \"/usr/bin/fuse-overlayfs\""  >> /etc/containers/storage.conf
#RUN sed -i -e 's|^#mount_program|mount_program|g' -e '/additionalimage.*/a "/var/lib/shared",' -e 's|^mountopt[[:space:]]*=.*$|mountopt = "nodev,fsync=0"|g' /etc/containers/storage.conf
#RUN mkdir -p /var/lib/shared/overlay-images /var/lib/shared/overlay-layers /var/lib/shared/vfs-images /var/lib/shared/vfs-layers; touch /var/lib/shared/overlay-images/images.lock; touch /var/lib/shared/overlay-layers/layers.lock; touch /var/lib/shared/vfs-images/images.lock; touch /var/lib/shared/vfs-layers/layers.lock
#ENV _CONTAINERS_USERNS_CONFIGURED=""

#RUN touch /etc/containers/registries.conf.d/myregistry.conf
#RUN echo "unqualified-search-registries = ['docker.io', 'quay.io', 'registry.ferrumgate.zero']" >> /etc/containers/registries.conf
#RUN echo "[[registry]]" >> /etc/containers/registries.conf
#RUN echo "location=\"registry.ferrumgate.zero\"" >> /etc/containers/registries.conf
#RUN echo "insecure=true" >> /etc/containers/registries.conf

#Create app directory
WORKDIR /usr/src/app

ADD node_modules/rest.portal2 /usr/src/rest.portal/build/src
WORKDIR /usr/src/rest.portal/build/src
RUN npm install
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
WORKDIR /usr/src/app
COPY package*.json /usr/src/app/

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

RUN ls /usr/src/app/node_modules/rest.portal
ADD build/src /usr/src/app/build/src
WORKDIR /usr/src/app
EXPOSE 9050
USER root
CMD ["npm","run","startdocker"]