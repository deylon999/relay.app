import{R as a,D as e}from"./settings.js";chrome.runtime.onInstalled.addListener(async()=>{(await chrome.storage.local.get(a))[a]||await chrome.storage.local.set({[a]:e})});
