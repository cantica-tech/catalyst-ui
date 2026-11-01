/** The Instances view: every deployment's chain inspector, one top-level entry each (REQ-000068-UVqkd7cL). */
export const VIEW_ID = "catalystChainInspector";

export const SHOW_DETAIL_COMMAND = "catalyst.showNodeDetail";

/** Catalyst: Search Items — a QuickPick over the Instances view's items (REQ-000076-UVqkd7cL). */
export const SEARCH_INSTANCES_COMMAND = "catalyst.searchInstances";

/** A bug's Close Bug and Reopen Bug, from its context menu in the Instances view (REQ-000077-UVqkd7cL). */
export const CLOSE_BUG_COMMAND = "catalyst.closeBug";
export const REOPEN_BUG_COMMAND = "catalyst.reopenBug";
/** The same, shown greyed out (never enabled) while catalyst would refuse the signer `/status`. */
export const CLOSE_BUG_DENIED_COMMAND = "catalyst.closeBug.denied";
export const REOPEN_BUG_DENIED_COMMAND = "catalyst.reopenBug.denied";

/** `catalyst.trackEntityInTree`: reveal the entity a detail panel shows (REQ-000017-UVqkd7cL). */
export const TRACK_SETTING = "trackEntityInTree";

/** `catalyst.ignoredFolders`: folders this workspace leaves out of catalyst (REQ-000015-UVqkd7cL). */
export const IGNORED_FOLDERS_SETTING = "ignoredFolders";

export const OPEN_JOURNAL_COMMAND = "catalyst.openJournal";

export const OPEN_BACKLOG_COMMAND = "catalyst.openBacklog";

export const SEND_TO_AGENT_CHAT_COMMAND = "catalyst.sendToAgentChat";
export const OPEN_STUDIO_COMMAND = "catalyst.openStudio";

export const CONFIGURE_CRITERION_COMMAND = "catalyst.configureCriterion";

export const REFRESH_CHAIN_INSPECTOR_COMMAND = "catalyst.refreshChainInspector";

export const LOAD_UI_MODULE_COMMAND = "catalyst.loadUiModule";

export const SELECT_KERNEL_VERSION_COMMAND = "catalyst.selectKernelVersion";

export const SWITCH_UI_MODULE_COMMAND = "catalyst.switchUiModule";

export const OPEN_SETTINGS_COMMAND = "catalyst.openSettings";

/** A folder with no catalyst, set up from its Instances entry (REQ-000069-UVqkd7cL). */
export const SET_UP_FOLDER_COMMAND = "catalyst.setUpFolder";

/** The local system account's check (REQ-000064-UVqkd7cL). */
export const CHECK_IAM_ACCOUNT_COMMAND = "catalyst.checkIamAccount";
/** Log a person in to catalyst-users with their username and password (vscode-IAM-000002-UVqkd7cL). */
export const IAM_LOGIN_COMMAND = "catalyst.iam.login";
/** Log the person out of catalyst-users (vscode-IAM-000002-UVqkd7cL, REQ-000075-UVqkd7cL). */
export const IAM_LOGOUT_COMMAND = "catalyst.iam.logout";
/** The context key that is true while someone is logged in to catalyst-users: the Users panel shows log-out, else log-in. */
export const USERS_LOGGED_IN_CONTEXT = "catalyst.users.loggedIn";
/** The Users panel: the identity provider's users, roles and groups (vscode-IAM-000003-UVqkd7cL). */
export const USERS_VIEW_ID = "catalystUsers";
/** `catalyst.users.refresh`: read the Users panel again through catalyst-users. */
export const REFRESH_USERS_COMMAND = "catalyst.users.refresh";
/** `catalyst.users.open`: open a user's, role's or group's document (kind, name). */
export const OPEN_DIRECTORY_COMMAND = "catalyst.users.open";

export const DIAGNOSTIC_COLLECTION_NAME = "catalyst";

export const ONBOARDING_DISMISSED_PREFIX = "catalyst.onboarding.dismissed:";

export const SYNC_OFFER_DISMISSED_PREFIX = "catalyst.syncOffer.dismissed:";
