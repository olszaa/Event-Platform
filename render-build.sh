#!/usr/bin/env bash
# exit on error
set -o errexit

pnpm install
npx prisma generate
npx prisma db push --accept-data-loss
pnpm run build --filter=@event-platform/api
