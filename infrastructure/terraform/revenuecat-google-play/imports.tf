import {
  to = google_service_account.revenuecat
  id = "projects/${var.project_id}/serviceAccounts/physilog-revenuecat@${var.project_id}.iam.gserviceaccount.com"
}

import {
  to = google_project_service.required["androidpublisher.googleapis.com"]
  id = "${var.project_id}/androidpublisher.googleapis.com"
}

import {
  to = google_project_service.required["playdeveloperreporting.googleapis.com"]
  id = "${var.project_id}/playdeveloperreporting.googleapis.com"
}
