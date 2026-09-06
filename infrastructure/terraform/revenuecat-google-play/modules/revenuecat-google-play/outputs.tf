output "service_account_email" {
  description = "Service account registered in Google Play Console and RevenueCat."
  value       = google_service_account.revenuecat.email
}

output "required_services" {
  description = "Google APIs required for RevenueCat Google Play validation."
  value       = sort(tolist(local.required_services))
}
