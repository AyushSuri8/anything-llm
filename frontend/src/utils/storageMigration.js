/**
 * One-time forward migration of legacy `anythingllm_*` localStorage keys
 * to their `usingopen_*` equivalents (UsingOpen rebrand).
 * Existing sessions, preferences, and UI state carry over untouched.
 */
const KEY_MAP = {
  anythingllm_appearance_settings: "usingopen_appearance_settings",
  anythingllm_authTimestamp: "usingopen_authTimestamp",
  anythingllm_authToken: "usingopen_authToken",
  anythingllm_can_view_chat_history: "usingopen_can_view_chat_history",
  anythingllm_completed_questionnaire: "usingopen_completed_questionnaire",
  anythingllm_custom_app_name: "usingopen_custom_app_name",
  anythingllm_deployment_version: "usingopen_deployment_version",
  anythingllm_experimental_feature_preview_unlocked:
    "usingopen_experimental_feature_preview_unlocked",
  anythingllm_footer_links: "usingopen_footer_links",
  anythingllm_last_visited_workspace: "usingopen_last_visited_workspace",
  anythingllm_pending_home_message: "usingopen_pending_home_message",
  anythingllm_pinned_document_alert: "usingopen_pinned_document_alert",
  anythingllm_seen_copy_link_chat_alert: "usingopen_seen_copy_link_chat_alert",
  anythingllm_show_chat_metrics: "usingopen_show_chat_metrics",
  anythingllm_show_metrics_change: "usingopen_show_metrics_change",
  anythingllm_sidebar_toggle: "usingopen_sidebar_toggle",
  anythingllm_support_email: "usingopen_support_email",
  anythingllm_text_size: "usingopen_text_size",
  anythingllm_tos_experimental_feature_set:
    "usingopen_tos_experimental_feature_set",
  anythingllm_user: "usingopen_user",
  anythingllm_user_prompt_input_map: "usingopen_user_prompt_input_map",
  anythingllm_watched_document_alert: "usingopen_watched_document_alert",
  "anythingllm-workspace-order": "usingopen-workspace-order",
};

const MIGRATION_FLAG = "usingopen_storage_migrated";

export function migrateLegacyStorageKeys() {
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === "1") return;
    for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
      if (localStorage.getItem(newKey) === null) {
        const value = localStorage.getItem(oldKey);
        if (value !== null) localStorage.setItem(newKey, value);
      }
    }
    localStorage.setItem(MIGRATION_FLAG, "1");
  } catch {
    // Storage unavailable (private mode, SSR) - ignore.
  }
}
