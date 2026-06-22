variable "project_name" {
  description = "Short lowercase name used in AWS resource names."
  type        = string
  default     = "intezo"
}

variable "aws_region" {
  description = "Region for EC2 and S3. Mumbai is the current primary region for this deployment."
  type        = string
  default     = "ap-south-1"
}

variable "instance_type" {
  description = "ARM instance for the API and Redis. t4g.micro minimizes Free Plan credit usage."
  type        = string
  default     = "t4g.micro"
}

variable "web_domain" {
  type    = string
  default = "web.intezo.online"
}

variable "api_domain" {
  type    = string
  default = "api.intezo.online"
}

variable "web_acm_certificate_arn" {
  description = "ARN of a validated ACM certificate for web.intezo.online created in us-east-1."
  type        = string
}
