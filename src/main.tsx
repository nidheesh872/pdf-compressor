import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type FileInfo = { path: string; name: string; size: number };
declare global {
  interface Window {
    pdfAPI: {
      pickPdf: () => Promise<FileInfo | null>;
      compressPdf: (data: { inputPath: string; targetBytes: number }) => Promise<any>;
      saveAs: (path: string) => Promise<string | null>;
      onProgress: (callback: (data: { percent: number; message: string }) => void) => void;
    };
  }
}

const MB = 1024 * 1024;
const formatSize = (bytes: number) => bytes >= MB ? `${(bytes / MB).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;

function App() {
  const [file, setFile] = useState<FileInfo | null>(null);
  const [target, setTarget] = useState("5");
  const [custom, setCustom] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => window.pdfAPI.onProgress(setProgress), []);

  const selectFile = async () => {
    const selected = await window.pdfAPI.pickPdf();
    if (selected) { setFile(selected); setResult(null); setError(""); }
  };

  const compress = async () => {
    if (!file) return;
    const targetMb = target === "custom" ? Number(custom) : Number(target);
    if (!targetMb || targetMb <= 0) { setError("Please enter a valid target size."); return; }
    setLoading(true); setError(""); setResult(null); setProgress({ percent: 2, message: "Starting compression..." });
    try {
      const data = await window.pdfAPI.compressPdf({ inputPath: file.path, targetBytes: targetMb * MB });
      setResult(data);
    } catch (e: any) { setError(e.message || "Compression failed."); }
    finally { setLoading(false); }
  };

  return <main>
    <div className="card">
      <h1>📄 Offline PDF Compressor</h1>
      <p className="subtitle">Compress PDF files locally. Your files never leave your computer.</p>

      <div className={`dropzone ${dragging ? "dragging" : ""}`}
        onClick={selectFile}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); selectFile(); }}>
        <div className="icon">⬆</div>
        <h3>{file ? file.name : "Drag & Drop PDF Here"}</h3>
        <p>{file ? `Original size: ${formatSize(file.size)}` : "or click to browse and select a PDF"}</p>
      </div>

      <div className="row">
        <label>Desired file size</label>
        <select value={target} onChange={e => setTarget(e.target.value)}>
          <option value="1">1 MB</option><option value="2">2 MB</option>
          <option value="5">5 MB</option><option value="10">10 MB</option>
          <option value="custom">Custom</option>
        </select>
        {target === "custom" && <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Enter MB" type="number" min="0.1" step="0.1" />}
      </div>

      <button className="primary" disabled={!file || loading} onClick={compress}>
        {loading ? "Compressing..." : "Compress PDF"}
      </button>

      {loading && <><div className="progress"><div style={{ width: `${progress.percent}%` }} /></div><p className="status">{progress.message} {progress.percent}%</p></>}
      {error && <div className="error">⚠ {error}</div>}
      {result && <div className="success">
        <h2>✓ Compression Complete</h2>
        <p>Original: <b>{formatSize(result.originalSize)}</b></p>
        <p>Compressed: <b>{formatSize(result.compressedSize)}</b></p>
        <p>Compression settings: {result.dpi} DPI</p>
        <button onClick={() => window.pdfAPI.saveAs(result.outputPath)}>Save As...</button>
      </div>}
    </div>
  </main>;
}
createRoot(document.getElementById("root")!).render(<App />);