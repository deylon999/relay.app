import type { RelayCaptureState, RelayMessage } from "../shared/messages";
import { RelayOverlay } from "./relayOverlay";

void initializeRelay();

async function initializeRelay(): Promise<void> {
  const overlay = new RelayOverlay(await loadRelaySettings());
  overlay.mount();

  await syncCaptureState(overlay);

  chrome.runtime.onMessage.addListener((message: RelayMessage) => {
    if (message.type === "RELAY_SETTINGS_CHANGED") {
      overlay.applySettings(message.settings);
      return;
    }

    if (message.type === "RELAY_SHOW_SAMPLE_SUBTITLE") {
      overlay.showSubtitle(message.text);
      return;
    }

    if (message.type === "RELAY_CAPTURE_STATUS_CHANGED") {
      overlay.applyCaptureState(message.state);
    }
  });
}

async function syncCaptureState(overlay: RelayOverlay): Promise<void> {
  try {
    const state = (await chrome.runtime.sendMessage({
      type: "RELAY_CONTENT_READY"
    } satisfies RelayMessage)) as RelayCaptureState | undefined;

    if (state) {
      overlay.applyCaptureState(state);
    }
  } catch {
    // The page may not be connected to the background yet.
  }
}

async function loadRelaySettings() {
  const stored = await chrome.storage.local.get("relay.settings");
  const settings = stored["relay.settings"] as
    | {
        targetLanguage?: string;
        subtitlePosition?: "bottom" | "top";
        subtitleScale?: number;
      }
    | undefined;

  return {
    targetLanguage: settings?.targetLanguage ?? "ru",
    subtitlePosition: settings?.subtitlePosition ?? "bottom",
    subtitleScale: settings?.subtitleScale ?? 1
  };
}
