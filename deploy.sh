#!/bin/bash

# Configuration
PROJECT_ID="spotcanvas-prod"
REGION="europe-west1"
SERVICE_NAME="spotcanvas-server"

# Build the container
echo "🏗️ Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated

echo "✅ Deployment complete!" 