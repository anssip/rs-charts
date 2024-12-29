#!/bin/bash

# Configuration
PROJECT_ID="spotcanvas-prod"
REGION="europe-west1"
SERVICE_NAME="spotcanvas-server"
SERVER_URL="https://chart-api.spotcanvas.com"

# Update secrets with properly formatted values
API_KEY=$(cat .env | grep COINBASE_API_KEY | cut -d '=' -f2-)
PRIVATE_KEY=$(cat .env | grep COINBASE_PRIVATE_KEY | cut -d '=' -f2- | sed 's/\\n/\n/g')

echo "Updating API key secret..."
echo "$API_KEY" | gcloud secrets versions add coinbase-api-key --data-file=- --project $PROJECT_ID

echo "Updating private key secret..."
echo "$PRIVATE_KEY" | gcloud secrets versions add coinbase-private-key --data-file=- --project $PROJECT_ID

# Build locally first to test
echo "🏗️ Building locally..."
if ! API_BASE_URL="$SERVER_URL" bun run build; then
    echo "❌ Local build failed! Exiting deployment..."
    exit 1
fi

# Build and deploy container
echo "🏗️ Building container image..."
if ! gcloud builds submit \
  --substitutions="_API_BASE_URL=$SERVER_URL,_SERVICE_NAME=$SERVICE_NAME" \
  --project $PROJECT_ID; then
    echo "❌ Build failed! Exiting deployment..."
    exit 1
fi

# Deploy to Cloud Run with secrets and environment variables
echo "🚀 Deploying to Cloud Run..."
if ! gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="COINBASE_API_KEY=coinbase-api-key:latest,COINBASE_PRIVATE_KEY=coinbase-private-key:latest"; then
    echo "❌ Deployment failed!"
    exit 1
fi

echo "✅ Deployment complete!" 