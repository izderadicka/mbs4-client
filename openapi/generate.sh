#!/usr/bin/env bash

pnpm exec openapi-typescript openapi.json --output types.ts

#other alternative could be 
# npx @openapitools/openapi-generator-cli generate -i openapi.json -g typescript-fetch -o ./client