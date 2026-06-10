import type { RelaySettings } from "./settings";

export type RelayCaptureStatus = "idle" | "starting" | "capturing" | "stopping" | "error";

export interface RelayCaptureState {
  tabId: number | null;
  status: RelayCaptureStatus;
  startedAt?: number;
  stoppedAt?: number;
  error?: string;
  chunkCount: number;
}

export interface RelayAudioChunk {
  tabId: number;
  sequence: number;
  mimeType: string;
  size: number;
  createdAt: number;
  blob?: Blob;
}

export type RelayMessage =
  | {
      type: "RELAY_SETTINGS_CHANGED";
      settings: RelaySettings;
    }
  | {
      type: "RELAY_SHOW_SAMPLE_SUBTITLE";
      text: string;
    }
  | {
      type: "RELAY_CAPTURE_START_REQUEST";
      tabId: number;
      settings: RelaySettings;
    }
  | {
      type: "RELAY_CAPTURE_STOP_REQUEST";
      tabId: number;
    }
  | {
      type: "RELAY_CAPTURE_STATUS_REQUEST";
      tabId: number;
    }
  | {
      type: "RELAY_CONTENT_READY";
    }
  | {
      type: "RELAY_CAPTURE_STATUS_CHANGED";
      state: RelayCaptureState;
    }
  | {
      type: "RELAY_OFFSCREEN_START_CAPTURE";
      tabId: number;
      streamId: string;
      chunkDurationMs: number;
      playbackGain: number;
    }
  | {
      type: "RELAY_OFFSCREEN_STOP_CAPTURE";
      tabId: number;
    }
  | {
      type: "RELAY_OFFSCREEN_CAPTURE_STATUS_REQUEST";
      tabId: number;
    }
  | {
      type: "RELAY_OFFSCREEN_CAPTURE_STATUS_CHANGED";
      state: RelayCaptureState;
    }
  | {
      type: "RELAY_OFFSCREEN_AUDIO_CHUNK_READY";
      chunk: RelayAudioChunk;
    };
