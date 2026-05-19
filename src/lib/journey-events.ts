export const JOURNEY_EVENT_NAMES = [
  "homepage_view",
  "article_view",
  "report_view",
  "energclub_page_view",
  "signup_cta_click",
  "login_cta_click",
  "dashboard_entered",
  "article_read",
  "return_visit",
  "signup_started",
  "otp_sent",
  "otp_verified",
  "signup_completed",
  "login_success",
  "auth_abandoned",
  "form_error",
  "rage_click",
  "field_abandonment",
] as const;

export type JourneyEventName = (typeof JOURNEY_EVENT_NAMES)[number];
