# Offline PDF Compressor

## Requirements
- Node.js 20+
- Ghostscript installed and available in PATH

## Run
```bash
npm install
npm run dev
```

## Build installer
```bash
npm run dist
```

The app processes PDFs locally using Ghostscript. No PDF is uploaded to any server.

### Windows Ghostscript
Install Ghostscript, then ensure its `bin` folder is in your Windows PATH. Restart the terminal after installation.
