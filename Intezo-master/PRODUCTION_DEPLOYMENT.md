# Intezo AWS production deployment

This runbook deploys the React frontend to private S3 + CloudFront and the API to one `t4g.micro` ARM EC2 instance running Caddy, Node, and Redis. PostgreSQL remains on the existing managed provider. Medical reports are stored in a separate private S3 bucket.

## 1. Account and local prerequisites

This configuration is deliberately optimized for the AWS Free Plan. The account closes after six months or when credits run out, so upgrade before either limit is reached to preserve the instance and data.

Install and authenticate:

- AWS CLI v2
- Terraform 1.5 or newer
- An AWS identity allowed to create EC2, IAM, S3, CloudFront, and security-group resources

Verify the account before creating anything:

```powershell
aws sts get-caller-identity
```

Create a billing budget and Free Tier usage alerts in the AWS Billing console before applying Terraform.

## 2. Create the frontend certificate

CloudFront requires its ACM certificate in `us-east-1`, regardless of the workload region.

1. Open ACM in `us-east-1`.
2. Request a public, non-exportable certificate for `web.intezo.online`.
3. Add the ACM validation CNAME to Cloudflare.
4. Wait until ACM reports `Issued` and copy the certificate ARN.

## 3. Provision AWS resources

```powershell
cd infra/terraform
Copy-Item terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars and insert the issued ACM certificate ARN.
terraform init
terraform plan
terraform apply
terraform output
```

The configuration creates:

- One encrypted `t4g.micro` EC2 instance with 1 GB swap and without SSH access
- An Elastic IP and ports 80/443 only
- An SSM instance role
- Private frontend, reports, and deployment S3 buckets
- CloudFront with Origin Access Control and SPA routing
- Least-privilege report/deployment bucket access for the API instance

After creation, open CloudFront **Plans** and select the `$0/month` plan for the frontend distribution if it is available in your account. Confirm the displayed allowance before relying on it.

Save the Terraform outputs. In particular, note `api_instance_id`, `api_public_ip`, `frontend_bucket`, `reports_bucket`, `deployments_bucket`, `cloudfront_distribution_id`, and `cloudfront_domain_name`.

## 4. Configure DNS

In Cloudflare:

1. Create `web` as a DNS-only CNAME to `cloudfront_domain_name`.
2. Create `api` as a DNS-only A record to `api_public_ip`.
3. Keep `api` DNS-only until Caddy obtains its first certificate.
4. After HTTPS works, the API record can be proxied through Cloudflare. Set SSL/TLS mode to **Full (strict)** and ensure WebSockets are enabled.

Do not create a Route 53 hosted zone unless you want to move authoritative DNS away from Cloudflare.

## 5. Package and upload the backend

From the repository root, create an archive that contains no secrets or patient uploads:

```powershell
$bucket = "REPLACE_WITH_DEPLOYMENTS_BUCKET"
tar --exclude=backend-intezo/node_modules --exclude=backend-intezo/uploads --exclude=backend-intezo/.env --exclude=backend-intezo/.env.production -czf intezo-release.tgz backend-intezo Caddyfile docker-compose.production.yml
aws s3 cp intezo-release.tgz "s3://$bucket/releases/intezo-release.tgz" --region ap-south-1
```

Start an SSM session:

```powershell
aws ssm start-session --target REPLACE_WITH_INSTANCE_ID --region ap-south-1
```

Inside the EC2 session:

```bash
sudo -s
mkdir -p /opt/intezo/releases/current /opt/intezo/shared
aws s3 cp s3://REPLACE_WITH_DEPLOYMENTS_BUCKET/releases/intezo-release.tgz /tmp/intezo-release.tgz
tar -xzf /tmp/intezo-release.tgz -C /opt/intezo/releases/current
cp /opt/intezo/releases/current/backend-intezo/.env.production.example /opt/intezo/shared/backend.env
chmod 600 /opt/intezo/shared/backend.env
nano /opt/intezo/shared/backend.env
```

Set `REPORTS_S3_BUCKET` to the Terraform `reports_bucket` output. Do not put AWS access keys in this file: the container obtains temporary credentials from the EC2 instance role.

Link the protected environment file and launch:

```bash
ln -sfn /opt/intezo/shared/backend.env /opt/intezo/releases/current/backend-intezo/.env.production
cd /opt/intezo/releases/current
ACME_EMAIL=YOUR_EMAIL docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
curl --fail https://api.intezo.online/healthz
curl --fail https://api.intezo.online/readyz
```

## 6. Deploy the frontend

From the repository root on Windows:

```powershell
.\scripts\deploy-frontend.ps1 `
  -Bucket REPLACE_WITH_FRONTEND_BUCKET `
  -DistributionId REPLACE_WITH_DISTRIBUTION_ID `
  -Region ap-south-1
```

Then verify direct navigation to routes such as `https://web.intezo.online/clinic/login`, authentication, profile uploads, report creation/download, and live queue updates.

## 7. Required post-deployment checks

- Confirm `https://api.intezo.online/uploads/reports/...` returns 404.
- Confirm one patient cannot read or update another patient's record.
- Confirm unauthenticated clients cannot join patient Socket.IO rooms.
- Confirm S3 Block Public Access is enabled for all three buckets.
- Confirm no AWS access keys or `.env` files are in Git history.
- Rotate the credentials formerly present in `docker-compose.yml`.
- Remove historical medical PDFs from Git history and decide whether affected users require notification under the applicable privacy rules.
- Test restoring PostgreSQL from backup before accepting production users.
