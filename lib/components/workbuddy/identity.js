export const SETTINGS_NAMESPACE = 'dsh-provider';
export const COMPONENT_ID = 'workbuddy';
export const MODEL_ROUTE = 'workbuddy';
/** Public client identity shared by CodeBuddy API-key chat and catalog requests. */
export function codeBuddyApiHeaders() {
    return {
        'User-Agent': 'CLI/2.177.0 CodeBuddy/2.177.0',
        'X-Product': 'SaaS', 'X-IDE-Type': 'CodeBuddy', 'X-IDE-Name': 'CodeBuddy',
    };
}
//# sourceMappingURL=identity.js.map