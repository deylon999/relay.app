var r=Object.defineProperty;var o=(e,t,a)=>t in e?r(e,t,{enumerable:!0,configurable:!0,writable:!0,value:a}):e[t]=a;var s=(e,t,a)=>o(e,typeof t!="symbol"?t+"":t,a);const i="Relay subtitles will appear here";class n{constructor(t){s(this,"host");s(this,"root");s(this,"subtitle");s(this,"status");s(this,"settings");s(this,"captureState");this.settings=t,this.captureState={tabId:null,status:"idle",chunkCount:0},this.host=document.createElement("div"),this.host.id="relay-extension-root",this.root=this.host.attachShadow({mode:"open"}),this.root.innerHTML=this.render(),this.subtitle=this.requireElement(".relay-overlay__subtitle"),this.status=this.requireElement(".relay-overlay__status")}mount(){document.documentElement.contains(this.host)||document.documentElement.append(this.host),this.applySettings(this.settings),this.applyCaptureState(this.captureState)}applySettings(t){this.settings=t,this.host.dataset.position=t.subtitlePosition,this.subtitle.style.setProperty("--relay-subtitle-scale",String(t.subtitleScale))}applyCaptureState(t){if(this.captureState=t,this.host.dataset.status=t.status,t.status==="idle"){this.subtitle.textContent=i,this.status.textContent="Relay idle";return}if(t.status==="starting"){this.status.textContent="Connecting audio",this.subtitle.textContent=i;return}if(t.status==="stopping"){this.status.textContent="Stopping capture",this.subtitle.textContent=i;return}if(t.status==="error"){this.status.textContent=t.error??"Capture failed",this.subtitle.textContent=i;return}this.status.textContent=`Capturing audio · ${t.chunkCount} chunks`}showSubtitle(t){this.subtitle.textContent=t}requireElement(t){const a=this.root.querySelector(t);if(!a)throw new Error(`Relay overlay element not found: ${t}`);return a}render(){return`
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

        :host([data-status="starting"]) .relay-overlay,
        :host([data-status="capturing"]) .relay-overlay,
        :host([data-status="stopping"]) .relay-overlay,
        :host([data-status="error"]) .relay-overlay {
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
        <div class="relay-overlay__subtitle">${i}</div>
      </div>
    `}}l();async function l(){const e=new n(await p());e.mount(),await u(e),chrome.runtime.onMessage.addListener(t=>{if(t.type==="RELAY_SETTINGS_CHANGED"){e.applySettings(t.settings);return}if(t.type==="RELAY_SHOW_SAMPLE_SUBTITLE"){e.showSubtitle(t.text);return}t.type==="RELAY_CAPTURE_STATUS_CHANGED"&&e.applyCaptureState(t.state)})}async function u(e){try{const t=await chrome.runtime.sendMessage({type:"RELAY_CONTENT_READY"});t&&e.applyCaptureState(t)}catch{}}async function p(){const t=(await chrome.storage.local.get("relay.settings"))["relay.settings"];return{targetLanguage:(t==null?void 0:t.targetLanguage)??"ru",subtitlePosition:(t==null?void 0:t.subtitlePosition)??"bottom",subtitleScale:(t==null?void 0:t.subtitleScale)??1}}
