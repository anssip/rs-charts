#!/bin/bash
PROJECT_ID="spotcanvas-prod"
REGION="europe-west1"
SERVICE_NAME="spotcanvas-server"
SERVER_URL="https://chart-api.spotcanvas.com"

# Update secrets with properly formatted values
echo "Updating API key secret..."
API_KEY=$(cat .env | grep COINBASE_API_KEY | cut -d '=' -f2-)
echo "$API_KEY" | gcloud secrets versions add coinbase-api-key --data-file=- --project $PROJECT_ID

echo "Updating private key secret..."
PRIVATE_KEY=$(cat .env | grep COINBASE_PRIVATE_KEY | cut -d '=' -f2- | sed 's/\\n/\n/g')
echo "$PRIVATE_KEY" | gcloud secrets versions add coinbase-private-key --data-file=- --project $PROJECT_ID
