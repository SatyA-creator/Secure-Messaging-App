# 🚀 Quick AWS Deployment Guide

## Fast Track Deployment (CloudFormation)

### Step 1: Deploy Infrastructure (5 minutes)

```bash
# Clone repository
git clone <your-repo>
cd messsaging-app

# Deploy CloudFormation stack
aws cloudformation create-stack \
  --stack-name quantchat-infrastructure \
  --template-body file://aws/cloudformation-template.yaml \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=production \
    ParameterKey=DBPassword,ParameterValue=YourSecurePassword123! \
    ParameterKey=DomainName,ParameterValue=yourdomain.com \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Wait for stack to complete (~10 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name quantchat-infrastructure \
  --region us-east-1
```

### Step 2: Get Stack Outputs

```bash
# Get infrastructure details
aws cloudformation describe-stacks \
  --stack-name quantchat-infrastructure \
  --query 'Stacks[0].Outputs' \
  --output table

# Save these values:
# - LoadBalancerDNS
# - DatabaseEndpoint
# - RedisEndpoint
# - ECSClusterName
```

### Step 3: Build and Push Docker Images (10 minutes)

```bash
# Make deployment script executable
chmod +x deploy-aws.sh

# Set environment variables
export AWS_REGION=us-east-1
export DB_PASSWORD=YourSecurePassword123!

# Run deployment script
./deploy-aws.sh
```

### Step 4: Create ECS Task Definitions

```bash
# Get your AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Update task definition files
sed -i "s/<AWS_ACCOUNT_ID>/$AWS_ACCOUNT_ID/g" aws/ecs-task-backend.json
sed -i "s/<AWS_ACCOUNT_ID>/$AWS_ACCOUNT_ID/g" aws/ecs-task-frontend.json

# Register task definitions
aws ecs register-task-definition \
  --cli-input-json file://aws/ecs-task-backend.json \
  --region us-east-1

aws ecs register-task-definition \
  --cli-input-json file://aws/ecs-task-frontend.json \
  --region us-east-1
```

### Step 5: Deploy ECS Services

```bash
# Get stack outputs
CLUSTER_NAME=$(aws cloudformation describe-stacks \
  --stack-name quantchat-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`ECSClusterName`].OutputValue' \
  --output text)

BACKEND_TG=$(aws cloudformation describe-stacks \
  --stack-name quantchat-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendTargetGroupArn`].OutputValue' \
  --output text)

# Create backend service
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name backend-service \
  --task-definition quantchat-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=$BACKEND_TG,containerName=backend,containerPort=8000 \
  --region us-east-1
```

### Step 6: Access Your Application

```bash
# Get Load Balancer DNS
ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name quantchat-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text)

echo "Application URL: http://$ALB_DNS"
```

---

## Alternative: Docker Compose (Local Testing)

```bash
# Start all services locally
docker-compose up -d

# Access application
# Frontend: http://localhost
# Backend: http://localhost:8000
# Database: localhost:5432
```

---

## Cost Calculator

**Monthly Costs (Estimated):**

| Resource | Configuration | Monthly Cost |
|----------|--------------|--------------|
| ECS Fargate | 2 tasks (0.5 vCPU, 1GB) | $30 |
| RDS PostgreSQL | db.t4g.micro | $20 |
| ElastiCache Redis | cache.t4g.micro | $15 |
| ALB | Standard | $20 |
| Data Transfer | 100GB | $9 |
| CloudWatch | 5GB logs | $2.50 |
| **TOTAL** | | **~$97/month** |

**Free Tier (First 12 months):**
- Can reduce to $0-20/month using free tier

---

## Monitoring

### View Logs

```bash
# Backend logs
aws logs tail /ecs/quantchat-backend --follow --region us-east-1

# Frontend logs
aws logs tail /ecs/quantchat-frontend --follow --region us-east-1
```

### Check Service Health

```bash
# ECS service status
aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services backend-service \
  --region us-east-1
```

---

## Cleanup (Delete Everything)

```bash
# Delete CloudFormation stack
aws cloudformation delete-stack \
  --stack-name quantchat-infrastructure \
  --region us-east-1

# Delete ECR images
aws ecr delete-repository \
  --repository-name quantchat-backend \
  --force \
  --region us-east-1

aws ecr delete-repository \
  --repository-name quantchat-frontend \
  --force \
  --region us-east-1
```

---

## Troubleshooting

### Issue: ECS tasks not starting

**Solution:**
1. Check CloudWatch logs for errors
2. Verify security groups allow traffic
3. Ensure task definition has correct image URIs

### Issue: Database connection failed

**Solution:**
1. Verify DATABASE_URL in task definition
2. Check RDS security group allows traffic from ECS security group
3. Confirm RDS is in available state

### Issue: WebSocket connections failing

**Solution:**
1. Update ALB idle timeout: `aws elbv2 modify-load-balancer-attributes --load-balancer-arn <ARN> --attributes Key=idle_timeout.timeout_seconds,Value=300`
2. Verify ALB listener forwards WebSocket upgrade headers
3. Check ECS task security group allows inbound on port 8000

---

## Next Steps

1. **Domain Setup**: Point your domain to ALB using Route 53
2. **SSL Certificate**: Request ACM certificate for HTTPS
3. **Auto-Scaling**: Configure ECS service auto-scaling
4. **CI/CD**: Set up GitHub Actions for automated deployments
5. **Monitoring**: Configure CloudWatch dashboards and alarms

For detailed instructions, see [AWS_DEPLOYMENT_GUIDE.md](../AWS_DEPLOYMENT_GUIDE.md)
