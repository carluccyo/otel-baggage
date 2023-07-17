FROM alpine:3.18.2

# GitHub packages authN token
RUN mkdir -p /app && \
    chown -R node:node /app


WORKDIR /app

COPY package.json package-lock.json ./

RUN echo //npm.pkg.github.com/:_authToken=$GITHUB_TOKEN > ~/.npmrc
RUN echo @JeevesInc:registry=https://npm.pkg.github.com/ >> ~/.npmrc

RUN npm ci

RUN echo > ~/.npmrc

COPY . .

RUN npm run build

CMD ["npm","run" "start-prod"]
