const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("pdfAPI", {
  pickPdf: () => ipcRenderer.invoke("pick-pdf"),
  compressPdf: (data) => ipcRenderer.invoke("compress-pdf", data),
  saveAs: (path) => ipcRenderer.invoke("save-compressed-as", path),
  onProgress: (callback) => ipcRenderer.on("compression-progress", (_, data) => callback(data))
});