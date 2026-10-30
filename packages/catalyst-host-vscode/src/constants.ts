/** The Instance(s) view: every deployment's chain inspector, one top-level entry each (REQ-000068-UVqkd7cL). */
export const VIEW_ID = "catalystChainInspector";

export const SHOW_DETAIL_COMMAND = "catalyst.showNodeDetail";

/** `catalyst.trackEntityInTree`: reveal the entity a detail panel shows (REQ-000017-UVqkd7cL). */
export const TRACK_SETTING = "trackEntityInTree";

/** `catalyst.ignoredFolders`: folders this workspace leaves out of catalyst (REQ-000015-UVqkd7cL). */
export const IGNORED_FOLDERS_SETTING = "ignoredFolders";

export const SHOW_IAM_DETAIL_COMMAND = "catalyst.showIamDetail";

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

/** A folder with no catalyst, set up from its Instance(s) entry (REQ-000069-UVqkd7cL). */
export const SET_UP_FOLDER_COMMAND = "catalyst.setUpFolder";

/** The local system account's check (REQ-000064-UVqkd7cL). */
export const CHECK_IAM_ACCOUNT_COMMAND = "catalyst.checkIamAccount";
/** Log a person in to catalyst-users with their username and password (vscode-IAM-000002-UVqkd7cL). */
export const IAM_LOGIN_COMMAND = "catalyst.iam.login";
/** The context value of a user in the side bar, for its context menu. */
export const USER_ITEM_CONTEXT = "catalystUser";

export const DIAGNOSTIC_COLLECTION_NAME = "catalyst";

export const ONBOARDING_DISMISSED_PREFIX = "catalyst.onboarding.dismissed:";

export const SYNC_OFFER_DISMISSED_PREFIX = "catalyst.syncOffer.dismissed:";
