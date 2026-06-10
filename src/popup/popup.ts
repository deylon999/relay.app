import type { RelayMessage } from "../shared/messages";
import { getRelaySettings, saveRelaySettings } from "../shared/storage";
import type { RelaySettings, SubtitlePosition } from "../shared/settings";
import "./popup.css";

const enabledInput = requireElement<HTMLInputElement>("enabled");
const targetLanguageInput = requireElement<HTMLSelectElement>("targetLanguage");
const subtitlePositionInput = requireElement<HTMLSelectElement>("subtitlePosition");
const subtitleScaleInput = requireElement<HTMLInputElement>("subtitleScale");
const statusElement = requireElement<HTMLParagraphElement>("status");

void initializePopup();

async function initializePopup(): Promise<void> {
  const settings = await getRelaySettings();
  syncForm(settings);

  enabledInput.addEventListener("change", handleFormChange);
  targetLanguageInput.addEventListener("change", handleFormChange);
  subtitlePositionInput.addEventListener("change", handleFormChange);
  subtitleScaleInput.addEventListener("input", handleFormChange);
}

async function handleFormChange(): Promise<void> {
  const settings = readForm();
  await saveRelaySettings(settings);
  await notifyActiveTab({
    type: "RELAY_SETTINGS_CHANGED",
    settings
  });

  if (settings.enabled) {
    await notifyActiveTab({
      type: "RELAY_SHOW_SAMPLE_SUBTITLE",
      text: `Relay is ready to translate into ${targetLanguageInput.selectedOptions[0]?.text ?? "your language"}`
    });
  }

  statusElement.textContent = settings.enabled ? "Enabled on this tab" : "Ready";
}

function syncForm(nextSettings: RelaySettings): void {
  enabledInput.checked = nextSettings.enabled;
  targetLanguageInput.value = nextSettings.targetLanguage;
  subtitlePositionInput.value = nextSettings.subtitlePosition;
  subtitleScaleInput.value = String(nextSettings.subtitleScale);
  statusElement.textContent = nextSettings.enabled ? "Enabled on this tab" : "Ready";
}

function readForm(): RelaySettings {
  return {
    enabled: enabledInput.checked,
    targetLanguage: targetLanguageInput.value,
    subtitlePosition: subtitlePositionInput.value as SubtitlePosition,
    subtitleScale: Number(subtitleScaleInput.value)
  };
}

async function notifyActiveTab(message: RelayMessage): Promise<void> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    statusElement.textContent = "Reload the page to inject Relay";
  }
}

function requireElement<ElementType extends HTMLElement>(id: string): ElementType {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Popup element not found: ${id}`);
  }

  return element as ElementType;
}
