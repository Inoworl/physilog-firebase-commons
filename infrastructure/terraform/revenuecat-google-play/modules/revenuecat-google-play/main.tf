locals {
  required_services = toset([
    "androidpublisher.googleapis.com",
    "playdeveloperreporting.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each = local.required_services

  project = var.project_id
  service = each.value

  disable_on_destroy = false
  deletion_policy    = "PREVENT"
}

resource "google_service_account" "revenuecat" {
  project      = var.project_id
  account_id   = var.service_account_id
  display_name = var.service_account_display_name
  description  = "RevenueCat Google Play subscription validation"

  deletion_policy = "PREVENT"
}
