#!/usr/bin/env bash

npx openapi-typescript openapi.json --output types.ts

#other alternative could be 
# npx @openapitools/openapi-generator-cli generate -i openapi.json -g typescript-fetch -o ./client