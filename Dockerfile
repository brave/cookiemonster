# Base application image
FROM node:lts-slim AS base
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.3 /lambda-adapter /opt/extensions/lambda-adapter

ARG DEBIAN_FRONTEND=noninteractive
ENV DEBIAN_FRONTEND=$DEBIAN_FRONTEND

ENV AWS_LWA_PORT=3000

RUN apt-get -qq update && \
    apt-get -qy install curl libasound2 libgtk-3-0 xdg-utils python3-minimal

WORKDIR /app
COPY package*.json /app
RUN npm install
COPY . /app

# Brave image
FROM base AS brave

ARG CHANNEL=nightly # release, beta, nightly
ARG PACKAGE_NAME=brave-browser-${CHANNEL}
ARG PACKAGE_NAME=${PACKAGE_NAME%%-release} # strip -release from the package name
ENV BRAVE_BINARY=/usr/bin/${PACKAGE_NAME}

RUN curl -fsSLo /usr/share/keyrings/${PACKAGE_NAME}-archive-keyring.gpg https://brave-browser-apt-${CHANNEL}.s3.brave.com/${PACKAGE_NAME}-archive-keyring.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/${PACKAGE_NAME}-archive-keyring.gpg] https://brave-browser-apt-${CHANNEL}.s3.brave.com/ stable main" | tee /etc/apt/sources.list.d/brave-browser-${CHANNEL}.list && \
    apt-get -qq update && \
    apt-get -qy install ${PACKAGE_NAME} && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/*

RUN chown -R node:node /app
USER node
RUN npm run setup -- ${BRAVE_BINARY}
RUN chmod -R o+rX /app/profiles

EXPOSE 3000
CMD npm run serve -- ${BRAVE_BINARY} 3000


FROM base AS chromium
RUN apt-get -qq update && \
    apt-get -qy install chromium --no-install-recommends && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/*
