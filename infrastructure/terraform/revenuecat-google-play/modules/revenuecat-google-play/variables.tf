variable "project_id" {
  description = "Google Cloud project that owns the RevenueCat service account."
  type        = string

  validation {
    condition     = length(trimspace(var.project_id)) > 0
    error_message = "project_id must not be empty."
  }
}

variable "service_account_id" {
  description = "Account ID for the RevenueCat Google Play service account."
  type        = string
  default     = "physilog-revenuecat"
}

variable "service_account_display_name" {
  description = "Display name for the RevenueCat Google Play service account."
  type        = string
  default     = "PhysiLog RevenueCat"
}
