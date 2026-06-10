import type { RelayAudioChunk, RelayCaptureState, RelayMessage } from "../shared/messages";

type TabAudioConstraints = MediaTrackConstraints & {
  mandatory: {
    chromeMediaSource: "tab";
    chromeMediaSourceId: string;
  };
};

interface ActiveCaptureSession {
  tabId: number;
  stream: MediaStream;
  audioContext: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
  gainNode: GainNode;
  recorder: MediaRecorder;
  sequence: number;
  chunkDurationMs: number;
}

const DEFAULT_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus"
];

let activeSession: ActiveCaptureSession | null = null;
let currentState: RelayCaptureState = createIdleState(null);

chrome.runtime.onMessage.addListener((message: RelayMessage, _sender, sendResponse) => {
  if (!isOffscreenMessage(message)) {
    return false;
  }

  void handleOffscreenMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse(createErrorState(activeSession?.tabId ?? null, getErrorMessage(error)));
    });

  return true;
});

async function handleOffscreenMessage(
  message: RelayMessage
): Promise<RelayCaptureState | { ok: true }> {
  switch (message.type) {
    case "RELAY_OFFSCREEN_START_CAPTURE":
      return startCapture(message.tabId, message.streamId, message.chunkDurationMs, message.playbackGain);
    case "RELAY_OFFSCREEN_STOP_CAPTURE":
      return stopCapture(message.tabId);
    case "RELAY_OFFSCREEN_CAPTURE_STATUS_REQUEST":
      return getCaptureStatus(message.tabId);
    default:
      return { ok: true };
  }
}

async function startCapture(
  tabId: number,
  streamId: string,
  chunkDurationMs: number,
  playbackGain: number
): Promise<RelayCaptureState> {
  if (activeSession && activeSession.tabId !== tabId) {
    await stopCapture(activeSession.tabId);
  }

  if (activeSession?.tabId === tabId && currentState.status === "capturing") {
    return currentState;
  }

  publishState({
    tabId,
    status: "starting",
    startedAt: Date.now(),
    chunkCount: 0
  });

  const stream = await openTabAudioStream(streamId);
  const audioContext = new AudioContext({ latencyHint: "interactive" });
  await audioContext.resume();
  const sourceNode = audioContext.createMediaStreamSource(stream);
  const gainNode = audioContext.createGain();
  gainNode.gain.value = playbackGain;
  sourceNode.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const recorder = new MediaRecorder(stream, createRecorderOptions());
  const session: ActiveCaptureSession = {
    tabId,
    stream,
    audioContext,
    sourceNode,
    gainNode,
    recorder,
    sequence: 0,
    chunkDurationMs
  };

  activeSession = session;
  wireSessionEvents(session);
  recorder.start(chunkDurationMs);

  publishState({
    tabId,
    status: "capturing",
    startedAt: Date.now(),
    chunkCount: 0
  });

  return currentState;
}

async function stopCapture(tabId: number): Promise<RelayCaptureState> {
  if (!activeSession || activeSession.tabId !== tabId) {
    return getCaptureStatus(tabId);
  }

  publishState({
    ...currentState,
    tabId,
    status: "stopping"
  });

  const session = activeSession;
  activeSession = null;
  await teardownSession(session);

  publishState(createIdleState(tabId));
  return currentState;
}

async function getCaptureStatus(_tabId: number): Promise<RelayCaptureState> {
  return currentState;
}

function wireSessionEvents(session: ActiveCaptureSession): void {
  const { recorder, stream } = session;

  stream.getAudioTracks().forEach((track) => {
    track.addEventListener(
      "ended",
      () => {
        if (activeSession?.tabId === session.tabId) {
          void stopCapture(session.tabId);
        }
      },
      { once: true }
    );
  });

  recorder.addEventListener("dataavailable", (event) => {
    if (!event.data.size || activeSession?.tabId !== session.tabId) {
      return;
    }

    session.sequence += 1;
    const chunk: RelayAudioChunk = {
      tabId: session.tabId,
      sequence: session.sequence,
      mimeType: recorder.mimeType,
      size: event.data.size,
      createdAt: Date.now(),
      blob: event.data
    };

    void chrome.runtime.sendMessage({
      type: "RELAY_OFFSCREEN_AUDIO_CHUNK_READY",
      chunk
    } satisfies RelayMessage);
  });

  recorder.addEventListener("error", () => {
    void failSession(session, "MediaRecorder stopped with an error.");
  });
}

async function failSession(session: ActiveCaptureSession, error: string): Promise<void> {
  publishState(createErrorState(session.tabId, error));
  if (activeSession?.tabId === session.tabId) {
    activeSession = null;
    await teardownSession(session).catch(() => {});
  }
}

async function teardownSession(session: ActiveCaptureSession): Promise<void> {
  const streamTracks = session.stream.getTracks();

  if (session.recorder.state !== "inactive") {
    const stopRecorder = waitForRecorderStop(session.recorder);
    session.recorder.stop();
    await stopRecorder;
  }

  streamTracks.forEach((track) => track.stop());
  session.sourceNode.disconnect();
  session.gainNode.disconnect();
  await session.audioContext.close();
}

function waitForRecorderStop(recorder: MediaRecorder): Promise<void> {
  return new Promise((resolve) => {
    recorder.addEventListener("stop", () => resolve(), { once: true });
  });
}

function openTabAudioStream(streamId: string): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    } as TabAudioConstraints,
    video: false
  };

  return navigator.mediaDevices.getUserMedia(constraints);
}

function createRecorderOptions(): MediaRecorderOptions {
  const mimeType = DEFAULT_MIME_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));

  return mimeType ? { mimeType } : {};
}

function publishState(state: RelayCaptureState): void {
  currentState = state;
  void chrome.runtime.sendMessage({
    type: "RELAY_OFFSCREEN_CAPTURE_STATUS_CHANGED",
    state
  } satisfies RelayMessage);
}

function isOffscreenMessage(message: RelayMessage): boolean {
  return (
    message.type === "RELAY_OFFSCREEN_START_CAPTURE" ||
    message.type === "RELAY_OFFSCREEN_STOP_CAPTURE" ||
    message.type === "RELAY_OFFSCREEN_CAPTURE_STATUS_REQUEST"
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

  return "Unknown Relay audio error.";
}
