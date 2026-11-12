const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

function createWindow() {
  const win = new BrowserWindow({
    width: 820, height: 760, minWidth: 700, minHeight: 650,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  if (process.env.NODE_ENV === "development") win.loadURL("http://127.0.0.1:5173");
  else win.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

function findGhostscript() {
  const candidates = process.platform === "win32"
    ? ["gswin64c.exe", "gswin32c.exe"]
    : process.platform === "darwin" ? ["gs"] : ["gs"];
  return candidates[0];
}

ipcMain.handle("pick-pdf", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  return { path: filePath, name: path.basename(filePath), size: fs.statSync(filePath).size };
});

ipcMain.handle("compress-pdf", async (event, { inputPath, targetBytes }) => {
  if (!fs.existsSync(inputPath)) throw new Error("Input PDF not found.");
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, ".pdf");
  const outputPath = path.join(dir, `${base}-compressed.pdf`);
  const tempPath = path.join(app.getPath("temp"), `${Date.now()}-compressed.pdf`);
  const gs = findGhostscript();

  // Try several DPI settings. Lower DPI generally creates a smaller PDF.
  const levels = [150, 120, 100, 85, 72, 60, 50];
  let best = null;

  for (let i = 0; i < levels.length; i++) {
    const dpi = levels[i];
    event.sender.send("compression-progress", { percent: Math.round((i / levels.length) * 90), message: `Trying ${dpi} DPI...` });
    try {
      await execFileAsync(gs, [
        "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
        "-dNOPAUSE", "-dQUIET", "-dBATCH",
        "-dDetectDuplicateImages=true",
        "-dDownsampleColorImages=true", "-dColorImageDownsampleType=/Bicubic",
        `-dColorImageResolution=${dpi}`,
        "-dDownsampleGrayImages=true", "-dGrayImageDownsampleType=/Bicubic",
        `-dGrayImageResolution=${dpi}`,
        "-dDownsampleMonoImages=true", `-dMonoImageResolution=${Math.max(150, dpi * 2)}`,
        `-sOutputFile=${tempPath}`, inputPath
      ]);
      if (!fs.existsSync(tempPath)) continue;
      const size = fs.statSync(tempPath).size;
      const candidate = { path: tempPath, size, dpi };
      if (!best || Math.abs(size - targetBytes) < Math.abs(best.size - targetBytes)) {
        if (best?.path && fs.existsSync(best.path)) {}
        const keep = path.join(app.getPath("temp"), `${Date.now()}-${dpi}.pdf`);
        fs.copyFileSync(tempPath, keep);
        best = { ...candidate, path: keep };
      }
      if (size <= targetBytes && size >= targetBytes * 0.80) break;
    } catch (e) {
      if (e.code === "ENOENT") throw new Error("Ghostscript is not installed or not found. Install Ghostscript and restart the app.");
    }
  }

  if (!best) throw new Error("Compression failed. The PDF may be corrupted or protected.");
  fs.copyFileSync(best.path, outputPath);
  event.sender.send("compression-progress", { percent: 100, message: "Done" });
  return { outputPath, name: path.basename(outputPath), originalSize: fs.statSync(inputPath).size, compressedSize: best.size, dpi: best.dpi };
});

ipcMain.handle("save-compressed-as", async (event, sourcePath) => {
  const result = await dialog.showSaveDialog({ defaultPath: path.basename(sourcePath), filters: [{ name: "PDF", extensions: ["pdf"] }] });
  if (result.canceled || !result.filePath) return null;
  fs.copyFileSync(sourcePath, result.filePath);
  return result.filePath;
});