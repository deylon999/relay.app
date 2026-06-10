import type { RelaySettings } from "../shared/settings";

const SAMPLE_TEXT = "Relay subtitles will appear here";

export class RelayOverlay {
  private readonly host: HTMLDivElement;
  private readonly root: ShadowRoot;
  private readonly subtitle: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private settings: RelaySettings;

  constructor(settings: RelaySettings) {
    this.settings = settings;
    this.host = document.createElement("div");
    this.host.id = "relay-extension-root";
    this.root = this.host.attachShadow({ mode: "open" });
    this.root.innerHTML = this.render();
    this.subtitle = this.requireElement<HTMLDivElement>(".relay-overlay__subtitle");
    this.status = this.requireElement<HTMLDivElement>(".relay-overlay__status");
  }

  mount(): void {
    if (!document.documentElement.contains(this.host)) {
      document.documentElement.append(this.host);
    }

    this.applySettings(this.settings);
  }

  applySettings(settings: RelaySettings): void {
    this.settings = settings;
    this.host.dataset.enabled = String(settings.enabled);
    this.host.dataset.position = settings.subtitlePosition;
    this.subtitle.style.setProperty("--relay-subtitle-scale", String(settings.subtitleScale));
    this.status.textContent = settings.enabled ? "Relay on" : "Relay off";

    if (!settings.enabled) {
      this.subtitle.textContent = SAMPLE_TEXT;
    }
  }

  showSubtitle(text: string): void {
    this.subtitle.textContent = text;
  }

  private requireElement<ElementType extends Element>(selector: string): ElementType {
    const element = this.root.querySelector<ElementType>(selector);

    if (!element) {
      throw new Error(`Relay overlay element not found: ${selector}`);
    }

    return element;
  }

  private render(): string {
    return `
      <style>
        :host {
          color-scheme: light dark;
        }

        .relay-overlay {
          bottom: 28px;
          box-sizing: border-box;
          display: grid;
          font-family:
            Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          gap: 10px;
          left: 50%;
          max-width: min(780px, calc(100vw - 32px));
          opacity: 0;
          pointer-events: none;
          position: fixed;
          transform: translateX(-50%) translateY(12px);
          transition:
            opacity 160ms ease,
            transform 160ms ease;
          width: max-content;
          z-index: 2147483647;
        }

        :host([data-position="top"]) .relay-overlay {
          bottom: auto;
          top: 28px;
        }

        :host([data-enabled="true"]) .relay-overlay {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }

        .relay-overlay__status {
          align-self: center;
          background: rgba(13, 18, 28, 0.78);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.26);
          color: rgba(255, 255, 255, 0.9);
          font-size: 12px;
          justify-self: center;
          letter-spacing: 0.02em;
          padding: 6px 10px;
        }

        .relay-overlay__subtitle {
          --relay-subtitle-scale: 1;
          backdrop-filter: blur(16px);
          background: rgba(8, 12, 20, 0.76);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 8px;
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.34);
          box-sizing: border-box;
          color: white;
          font-size: calc(22px * var(--relay-subtitle-scale));
          font-weight: 650;
          line-height: 1.35;
          max-width: min(780px, calc(100vw - 32px));
          padding: 14px 18px;
          text-align: center;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
          width: max-content;
        }
      </style>
      <div class="relay-overlay" aria-live="polite">
        <div class="relay-overlay__status">Relay off</div>
        <div class="relay-overlay__subtitle">${SAMPLE_TEXT}</div>
      </div>
    `;
  }
}
