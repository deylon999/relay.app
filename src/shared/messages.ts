import type { RelaySettings } from "./settings";

export type RelayMessage =
  | {
      type: "RELAY_SETTINGS_CHANGED";
      settings: RelaySettings;
    }
  | {
      type: "RELAY_SHOW_SAMPLE_SUBTITLE";
      text: string;
    };
