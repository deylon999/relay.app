import type { RelayMessage } from "../shared/messages";
import { getRelaySettings } from "../shared/storage";
import { RelayOverlay } from "./relayOverlay";

void initializeRelay();

async function initializeRelay(): Promise<void> {
  const overlay = new RelayOverlay(await getRelaySettings());
  overlay.mount();

  chrome.runtime.onMessage.addListener((message: RelayMessage) => {
    if (message.type === "RELAY_SETTINGS_CHANGED") {
      overlay.applySettings(message.settings);
      return;
    }

    if (message.type === "RELAY_SHOW_SAMPLE_SUBTITLE") {
      overlay.showSubtitle(message.text);
    }
  });
}
