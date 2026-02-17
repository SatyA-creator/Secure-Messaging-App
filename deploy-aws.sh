#!/bin/bash
# AWS Deployment Script for QuantChat
set -e

echo "🚀 QuantChat AWS Deployment Script"
echo "===================================="

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
APP_NAME="quantchat"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    command -v aws >/dev/null 2>&1 || { log_error "AWS CLI is not installed. Install it first."; exit 1; }
    command -v docker >/dev/null 2>&1 || { log_error "Docker is not installed. Install it first."; exit 1; }
    
    # Check AWS credentials
    aws sts get-caller-identity >/dev/null 2>&1 || { log_error "AWS credentials not configured. Run 'aws configure'"; exit 1; }
    
    log_info "✓ All prerequisites met"
}

# Get AWS Account ID
get_account_id() {
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    log_info "AWS Account ID: $AWS_ACCOUNT_ID"
}

# Create ECR repositories
create_ecr_repos() {
    log_info "Creating ECR repositories..."
    
    aws ecr create-repository --repository-name ${APP_NAME}-frontend --region ${AWS_REGION} 2>/dev/null || log_warn "Frontend repo already exists"
    aws ecr create-repository --repository-name ${APP_NAME}-backend --region ${AWS_REGION} 2>/dev/null || log_warn "Backend repo already exists"
    
    log_info "✓ ECR repositories ready"
}

# Build and push Docker images
build_and_push() {
    log_info "Building and pushing Docker images..."
    
    # Login to ECR
    aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
    
    # Build backend
    log_info "Building backend image..."
    docker build -t ${APP_NAME}-backend -f backend/Dockerfile backend/
    docker tag ${APP_NAME}-backend:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}-backend:latest
    docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}-backend:latest
    
    # Build frontend
    log_info "Building frontend image..."
    docker build -t ${APP_NAME}-frontend -f Dockerfile.frontend .
    docker tag ${APP_NAME}-frontend:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}-frontend:latest
    docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}-frontend:latest
    
    log_info "✓ Images built and pushed to ECR"
}

# Create RDS database
create_database() {
    log_info "Setting up RDS PostgreSQL database..."
    
    DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 32)}"
    
    aws rds create-db-instance \
        --db-instance-identifier ${APP_NAME}-db-${ENVIRONMENT} \
        --db-instance-class db.t4g.micro \
        --engine postgres \
        --engine-version 15.4 \
        --master-username admin \
        --master-user-password "${DB_PASSWORD}" \
        --allocated-storage 20 \
        --db-name ${APP_NAME} \
        --backup-retention-period 7 \
        --storage-encrypted \
        --region ${AWS_REGION} 2>/dev/null || log_warn "Database already exists"
    
    log_info "Database password: ${DB_PASSWORD}"
    log_warn "⚠️  Save this password securely!"
    
    log_info "✓ Database creation initiated (will take 5-10 minutes)"
}

# Create ECS cluster
create_ecs_cluster() {
    log_info "Creating ECS cluster..."
    
    aws ecs create-cluster \
        --cluster-name ${APP_NAME}-cluster-${ENVIRONMENT} \
        --region ${AWS_REGION} 2>/dev/null || log_warn "Cluster already exists"
    
    log_info "✓ ECS cluster ready"
}

# Main deployment flow
main() {
    log_info "Starting deployment process..."
    echo ""
    
    check_prerequisites
    get_account_id
    create_ecr_repos
    build_and_push
    create_database
    create_ecs_cluster
    
    echo ""
    log_info "🎉 Initial deployment complete!"
    echo ""
    echo "Next steps:"
    echo "1. Wait for RDS database to become available (~5-10 minutes)"
    echo "2. Create task definitions in ECS"
    echo "3. Set up Application Load Balancer"
    echo "4. Deploy ECS services"
    echo "5. Configure Route 53 DNS"
    echo ""
    echo "Refer to AWS_DEPLOYMENT_GUIDE.md for detailed instructions"
}

# Run main function
main
