output "api_instance_id" {
  value = aws_instance.api.id
}

output "api_public_ip" {
  value = aws_eip.api.public_ip
}

output "frontend_bucket" {
  value = aws_s3_bucket.frontend.id
}

output "reports_bucket" {
  value = aws_s3_bucket.reports.id
}

output "deployments_bucket" {
  value = aws_s3_bucket.deployments.id
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.frontend.domain_name
}
