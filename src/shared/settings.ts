export type SubtitlePosition = "bottom" | "top";

export interface RelaySettings {
  enabled: boolean;
  targetLanguage: string;
  subtitlePosition: SubtitlePosition;
  subtitleScale: number;
}

export const DEFAULT_SETTINGS: RelaySettings = {
  enabled: false,
  targetLanguage: "ru",
  subtitlePosition: "bottom",
  subtitleScale: 1
};

export const RELAY_SETTINGS_KEY = "relay.settings";
