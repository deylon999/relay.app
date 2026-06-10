import { DEFAULT_SETTINGS, RELAY_SETTINGS_KEY } from "../shared/settings";

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(RELAY_SETTINGS_KEY);

  if (!stored[RELAY_SETTINGS_KEY]) {
    await chrome.storage.local.set({
      [RELAY_SETTINGS_KEY]: DEFAULT_SETTINGS
    });
  }
});
