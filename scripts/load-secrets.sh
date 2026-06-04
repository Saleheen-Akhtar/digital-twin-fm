#!/bin/bash
# Example: Load secrets from Infisical and export as environment variables
# Uncomment and configure if using Infisical
# infisical export --env=dev --plain > .env
# export $(cat .env | xargs)
echo "To load Infisical secrets, run: infisical export --env=dev --plain > .env && export $(cat .env | xargs)"
echo "For local development, copy .env.example to .env and fill in values."
