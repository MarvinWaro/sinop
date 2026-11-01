# syntax=docker/dockerfile:1

# SINOP production image: PHP + nginx on Alpine (serversideup/php), port 8080.
# GitHub Actions builds it (.github/workflows/docker-image.yml), GHCR stores
# it and Coolify runs it. No secrets here: they are Coolify variables.

ARG PHP_VERSION=8.4

# ---- Base: PHP, nginx and SINOP's extensions ---------------------------------
FROM serversideup/php:${PHP_VERSION}-fpm-nginx-alpine AS base

USER root
# gd (with FreeType): QR codes, the signature stamp, spreadsheet images.
# intl, bcmath, exif: number/date formatting, PhpSpreadsheet, photo uploads.
RUN install-php-extensions gd intl bcmath exif
USER www-data

# ---- PHP packages (production only, cached until composer.lock changes) -----
FROM base AS vendor
USER root
WORKDIR /var/www/html
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist \
        --no-scripts --no-autoloader

# ---- Frontend build ------------------------------------------------------------
# Wayfinder generates the route helpers with artisan during the build, so this
# stage has PHP and the packages as well as Node. None of it ships.
FROM vendor AS assets
RUN apk add --no-cache nodejs npm
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund --cache /tmp/npm-cache
COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && npm run build \
    && rm -rf node_modules /tmp/npm-cache

# ---- Final image -------------------------------------------------------------
FROM base

ENV PHP_OPCACHE_ENABLE=1 \
    PHP_MEMORY_LIMIT=512M \
    PHP_MAX_EXECUTION_TIME=120 \
    PHP_UPLOAD_MAX_FILE_SIZE=25M \
    PHP_POST_MAX_SIZE=110M \
    SSL_MODE=off \
    AUTORUN_ENABLED=true \
    AUTORUN_LARAVEL_STORAGE_LINK=true \
    AUTORUN_LARAVEL_MIGRATION=true

WORKDIR /var/www/html
COPY --chown=www-data:www-data . .
COPY --chown=www-data:www-data --from=assets /var/www/html/vendor ./vendor
COPY --chown=www-data:www-data --from=assets /var/www/html/bootstrap/cache ./bootstrap/cache
COPY --chown=www-data:www-data --from=assets /var/www/html/public/build ./public/build

USER www-data
