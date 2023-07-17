FROM node:18-alpine3.18

# GitHub packages authN token
RUN mkdir -p /app && \
    chown -R node:node /app


WORKDIR /app

COPY package.json package-lock.json ./

RUN echo //npm.pkg.github.com/:_authToken=$GITHUB_TOKEN > ~/.npmrc

RUN npm ci

RUN echo > ~/.npmrc

COPY . .

CMD ["npm","run" "start"]
