output "service_account_email" {
  description = "Production service account registered in Google Play Console and RevenueCat."
  value       = module.revenuecat_google_play.service_account_email
}

output "required_services" {
  description = "Google APIs required for RevenueCat Google Play validation."
  value       = module.revenuecat_google_play.required_services
}
