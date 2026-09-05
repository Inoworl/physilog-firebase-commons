variable "project_id" {
  description = "Google Cloud project that owns the shared RevenueCat service account."
  type        = string
  default     = "physilog-dev"

  validation {
    condition     = var.project_id == "physilog-dev"
    error_message = "This stack manages the existing shared RevenueCat service account in physilog-dev."
  }
}
