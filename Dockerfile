FROM node:lts

ARG CHANNEL=nightly # release, beta, nightly

ARG DEBIAN_FRONTEND=noninteractive
ARG PACKAGE_NAME=brave-browser-${CHANNEL}
ARG PACKAGE_NAME=${PACKAGE_NAME%%-release} # strip -release from the package name
ENV BRAVE_BINARY=/usr/bin/${PACKAGE_NAME}

ENV DEBIAN_FRONTEND=$DEBIAN_FRONTEND

RUN curl -fsSLo /usr/share/keyrings/${PACKAGE_NAME}-archive-keyring.gpg https://brave-browser-apt-${CHANNEL}.s3.brave.com/${PACKAGE_NAME}-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/${PACKAGE_NAME}-archive-keyring.gpg] https://brave-browser-apt-${CHANNEL}.s3.brave.com/ stable main" | tee /etc/apt/sources.list.d/brave-browser-${CHANNEL}.list && \
    apt-get -qq update && \
    apt-get -qy install ${PACKAGE_NAME} xvfb && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/*

WORKDIR /app
COPY . /app
RUN npm install

USER node
RUN xvfb-run -e /dev/stdout -s "-screen 0 1280x1024x24 -ac -nolisten tcp -nolisten unix" npm run setup -- ${BRAVE_BINARY}

EXPOSE 3000
CMD npm run serve -- ${BRAVE_BINARY} 3000
