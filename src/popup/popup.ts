import type { RelayCaptureState, RelayMessage } from "../shared/messages";
import { getRelaySettings, saveRelaySettings } from "../shared/storage";
import { DEFAULT_SETTINGS, type RelaySettings, type SubtitlePosition } from "../shared/settings";
import "./popup.css";

const enabledInput = requireElement<HTMLInputElement>("enabled");
const targetLanguageInput = requireElement<HTMLSelectElement>("targetLanguage");
const subtitlePositionInput = requireElement<HTMLSelectElement>("subtitlePosition");
const subtitleScaleInput = requireElement<HTMLInputElement>("subtitleScale");
const statusElement = requireElement<HTMLParagraphElement>("status");

let currentSettings = DEFAULT_SETTINGS;
let currentCaptureState: RelayCaptureState = createIdleState(null);

void initializePopup();

async function initializePopup(): Promise<void> {
  currentSettings = await getRelaySettings();
  const tabId = await getActiveTabId();
  if (tabId !== null) {
    currentCaptureState = await requestCaptureStatus(tabId);
  }

  syncForm(currentSettings, currentCaptureState);
  bindEvents();

  chrome.runtime.onMessage.addListener((message: RelayMessage) => {
    if (message.type !== "RELAY_CAPTURE_STATUS_CHANGED") {
      return;
    }

    if (message.state.tabId === currentCaptureState.tabId) {
      currentCaptureState = message.state;
      syncCaptureUI(message.state);
    }
  });
}

function bindEvents(): void {
  enabledInput.addEventListener("change", handleEnabledChange);
  targetLanguageInput.addEventListener("change", handleSettingsChange);
  subtitlePositionInput.addEventListener("change", handleSettingsChange);
  subtitleScaleInput.addEventListener("input", handleSettingsChange);
}

async function handleEnabledChange(): Promise<void> {
  const tabId = await getActiveTabId();

  if (tabId === null) {
    enabledInput.checked = false;
    statusElement.textContent = "Open a tab to capture audio";
    return;
  }

  const response = enabledInput.checked
    ? await chrome.runtime.sendMessage({
        type: "RELAY_CAPTURE_START_REQUEST",
        tabId,
        settings: currentSettings
      } satisfies RelayMessage)
    : await chrome.runtime.sendMessage({
        type: "RELAY_CAPTURE_STOP_REQUEST",
        tabId
      } satisfies RelayMessage);

  if (response && typeof response === "object" && "status" in response) {
    currentCaptureState = response as RelayCaptureState;
    syncCaptureUI(currentCaptureState);
  }
}

async function handleSettingsChange(): Promise<void> {
  currentSettings = readSettings();
  await saveRelaySettings(currentSettings);
  await notifyActiveTab({
    type: "RELAY_SETTINGS_CHANGED",
    settings: currentSettings
  });

  statusElement.textContent = statusForState(currentCaptureState);
}

function syncForm(settings: RelaySettings, captureState: RelayCaptureState): void {
  targetLanguageInput.value = settings.targetLanguage;
  subtitlePositionInput.value = settings.subtitlePosition;
  subtitleScaleInput.value = String(settings.subtitleScale);
  syncCaptureUI(captureState);
}

function syncCaptureUI(captureState: RelayCaptureState): void {
  enabledInput.checked = captureState.status === "starting" || captureState.status === "capturing";
  statusElement.textContent = statusForState(captureState);
}

function statusForState(captureState: RelayCaptureState): string {
  switch (captureState.status) {
    case "starting":
      return "Connecting audio";
    case "capturing":
      return "Capturing tab audio";
    case "stopping":
      return "Stopping capture";
    case "error":
      return captureState.error ?? "Capture failed";
    default:
      return "Ready";
  }
}

function readSettings(): RelaySettings {
  return {
    targetLanguage: targetLanguageInput.value,
    subtitlePosition: subtitlePositionInput.value as SubtitlePosition,
    subtitleScale: Number(subtitleScaleInput.value)
  };
}

async function requestCaptureStatus(tabId: number): Promise<RelayCaptureState> {
  const response = (await chrome.runtime.sendMessage({
    type: "RELAY_CAPTURE_STATUS_REQUEST",
    tabId
  } satisfies RelayMessage)) as RelayCaptureState | undefined;

  return response ?? createIdleState(tabId);
}

async function notifyActiveTab(message: RelayMessage): Promise<void> {
  const tabId = await getActiveTabId();

  if (tabId === null) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    statusElement.textContent = "Reload the page to inject Relay";
  }
}

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tab?.id ?? null;
}

function requireElement<ElementType extends HTMLElement>(id: string): ElementType {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Popup element not found: ${id}`);
  }

  return element as ElementType;
}

function createIdleState(tabId: number | null): RelayCaptureState {
  return {
    tabId,
    status: "idle",
    chunkCount: 0
  };
}
