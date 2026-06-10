import { DEFAULT_SETTINGS, RELAY_SETTINGS_KEY, type RelaySettings } from "./settings";

export async function getRelaySettings(): Promise<RelaySettings> {
  const stored = await chrome.storage.local.get(RELAY_SETTINGS_KEY);
  const settings = stored[RELAY_SETTINGS_KEY] as Partial<RelaySettings> | undefined;

  return {
    ...DEFAULT_SETTINGS,
    ...settings
  };
}

export async function saveRelaySettings(settings: RelaySettings): Promise<void> {
  await chrome.storage.local.set({
    [RELAY_SETTINGS_KEY]: settings
  });
}
