import { DEFAULT_SETTINGS, RELAY_SETTINGS_KEY } from "../shared/settings";
import type { RelayAudioChunk, RelayCaptureState, RelayMessage } from "../shared/messages";

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
const AUDIO_CHUNK_DURATION_MS = 4000;
const ORIGINAL_PLAYBACK_GAIN = 1;

let activeCaptureState: RelayCaptureState = createIdleState(null);
let creatingOffscreenDocument: Promise<void> | null = null;

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(RELAY_SETTINGS_KEY);

  if (!stored[RELAY_SETTINGS_KEY]) {
    await chrome.storage.local.set({
      [RELAY_SETTINGS_KEY]: DEFAULT_SETTINGS
    });
  }
});

chrome.runtime.onMessage.addListener((message: RelayMessage, sender, sendResponse) => {
  if (!isBackgroundMessage(message)) {
    return false;
  }

  void handleBackgroundMessage(message, sender)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse(createErrorState(null, getErrorMessage(error)));
    });

  return true;
});

async function handleBackgroundMessage(
  message: RelayMessage,
  sender: chrome.runtime.MessageSender
): Promise<RelayCaptureState | { ok: true }> {
  switch (message.type) {
    case "RELAY_CAPTURE_START_REQUEST":
      return startCapture(message.tabId);
    case "RELAY_CAPTURE_STOP_REQUEST":
      return stopCapture(message.tabId);
    case "RELAY_CAPTURE_STATUS_REQUEST":
      return getCaptureStatus(message.tabId);
    case "RELAY_CONTENT_READY":
      return getCaptureStatus(sender.tab?.id ?? null);
    case "RELAY_OFFSCREEN_CAPTURE_STATUS_CHANGED":
      activeCaptureState = message.state;
      await notifyTabCaptureState(message.state);
      return { ok: true };
    case "RELAY_OFFSCREEN_AUDIO_CHUNK_READY":
      await handleAudioChunk(message.chunk);
      return { ok: true };
    default:
      return { ok: true };
  }
}

async function startCapture(tabId: number): Promise<RelayCaptureState> {
  if (activeCaptureState.status === "capturing" || activeCaptureState.status === "starting") {
    if (activeCaptureState.tabId === tabId) {
      return activeCaptureState;
    }

    await stopCapture(activeCaptureState.tabId);
  }

  activeCaptureState = {
    tabId,
    status: "starting",
    startedAt: Date.now(),
    chunkCount: 0
  };
  await notifyTabCaptureState(activeCaptureState);

  try {
    await ensureOffscreenDocument();
    const streamId = await getTabMediaStreamId(tabId);
    const state = await sendOffscreenMessage({
      type: "RELAY_OFFSCREEN_START_CAPTURE",
      tabId,
      streamId,
      chunkDurationMs: AUDIO_CHUNK_DURATION_MS,
      playbackGain: ORIGINAL_PLAYBACK_GAIN
    });

    activeCaptureState = state;
    await notifyTabCaptureState(state);
    return state;
  } catch (error: unknown) {
    activeCaptureState = createErrorState(tabId, getErrorMessage(error));
    await notifyTabCaptureState(activeCaptureState);
    return activeCaptureState;
  }
}

async function stopCapture(tabId: number | null): Promise<RelayCaptureState> {
  if (tabId === null) {
    activeCaptureState = createIdleState(null);
    return activeCaptureState;
  }

  const stoppingState: RelayCaptureState = {
    ...activeCaptureState,
    tabId,
    status: "stopping"
  };
  activeCaptureState = stoppingState;
  await notifyTabCaptureState(stoppingState);

  if (await hasOffscreenDocument()) {
    try {
      activeCaptureState = await sendOffscreenMessage({
        type: "RELAY_OFFSCREEN_STOP_CAPTURE",
        tabId
      });
    } catch {
      activeCaptureState = createIdleState(tabId);
    }

    await closeOffscreenDocument();
  } else {
    activeCaptureState = createIdleState(tabId);
  }

  await notifyTabCaptureState(activeCaptureState);
  return activeCaptureState;
}

async function getCaptureStatus(tabId: number | null): Promise<RelayCaptureState> {
  if (tabId === null) {
    return createIdleState(null);
  }

  if (activeCaptureState.status === "idle" && (await hasOffscreenDocument())) {
    try {
      const offscreenState = await sendOffscreenMessage({
        type: "RELAY_OFFSCREEN_CAPTURE_STATUS_REQUEST",
        tabId
      });

      if (offscreenState.status !== "idle" || offscreenState.tabId !== null) {
        activeCaptureState = offscreenState;
      }
    } catch {
      // If the offscreen document is stale, fall back to the in-memory state.
    }
  }

  if (activeCaptureState.tabId !== tabId) {
    return createIdleState(tabId);
  }

  return activeCaptureState;
}

async function handleAudioChunk(chunk: RelayAudioChunk): Promise<void> {
  if (activeCaptureState.tabId !== chunk.tabId || activeCaptureState.status !== "capturing") {
    return;
  }

  activeCaptureState = {
    ...activeCaptureState,
    chunkCount: chunk.sequence
  };

  await notifyTabCaptureState(activeCaptureState);
}

async function ensureOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    return;
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.USER_MEDIA],
        justification: "Relay captures tab audio for realtime translation and voiceover."
      })
      .finally(() => {
        creatingOffscreenDocument = null;
      });
  }

  await creatingOffscreenDocument;
}

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
  });

  return contexts.length > 0;
}

async function closeOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
}

async function sendOffscreenMessage(message: RelayMessage): Promise<RelayCaptureState> {
  const response = (await chrome.runtime.sendMessage(message)) as RelayCaptureState | undefined;

  if (!response) {
    throw new Error("Relay audio worker did not respond.");
  }

  return response;
}

function getTabMediaStreamId(tabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      const error = chrome.runtime.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      if (!streamId) {
        reject(new Error("Chrome did not return a tab audio stream id."));
        return;
      }

      resolve(streamId);
    });
  });
}

async function notifyTabCaptureState(state: RelayCaptureState): Promise<void> {
  if (state.tabId === null) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(state.tabId, {
      type: "RELAY_CAPTURE_STATUS_CHANGED",
      state
    } satisfies RelayMessage);
  } catch {
    // Content scripts are not available on every Chrome page.
  }
}

function isBackgroundMessage(message: RelayMessage): boolean {
  return (
    message.type === "RELAY_CAPTURE_START_REQUEST" ||
    message.type === "RELAY_CAPTURE_STOP_REQUEST" ||
    message.type === "RELAY_CAPTURE_STATUS_REQUEST" ||
    message.type === "RELAY_CONTENT_READY" ||
    message.type === "RELAY_OFFSCREEN_CAPTURE_STATUS_CHANGED" ||
    message.type === "RELAY_OFFSCREEN_AUDIO_CHUNK_READY"
  );
}

function createIdleState(tabId: number | null): RelayCaptureState {
  return {
    tabId,
    status: "idle",
    stoppedAt: Date.now(),
    chunkCount: 0
  };
}

function createErrorState(tabId: number | null, error: string): RelayCaptureState {
  return {
    tabId,
    status: "error",
    error,
    stoppedAt: Date.now(),
    chunkCount: 0
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown Relay capture error.";
}
