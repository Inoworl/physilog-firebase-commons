locals {
  project_id = "physilog-cb6cd"
}

provider "google" {
  project = local.project_id
}

module "revenuecat_google_play" {
  source = "../../modules/revenuecat-google-play"

  project_id = local.project_id
}
