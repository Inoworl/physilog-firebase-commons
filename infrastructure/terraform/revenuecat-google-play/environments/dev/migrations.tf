moved {
  from = google_service_account.revenuecat
  to   = module.revenuecat_google_play.google_service_account.revenuecat
}

moved {
  from = google_project_service.required
  to   = module.revenuecat_google_play.google_project_service.required
}

import {
  to = module.revenuecat_google_play.google_service_account.revenuecat
  id = "projects/${local.project_id}/serviceAccounts/physilog-revenuecat@${local.project_id}.iam.gserviceaccount.com"
}

import {
  to = module.revenuecat_google_play.google_project_service.required["androidpublisher.googleapis.com"]
  id = "${local.project_id}/androidpublisher.googleapis.com"
}

import {
  to = module.revenuecat_google_play.google_project_service.required["playdeveloperreporting.googleapis.com"]
  id = "${local.project_id}/playdeveloperreporting.googleapis.com"
}
