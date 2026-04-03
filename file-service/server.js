const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.FILE_SERVICE_PORT || 4318);
const HOST = process.env.FILE_SERVICE_HOST || "127.0.0.1";
const API_PREFIX = "/api/local-files";
const DATA_DIR = path.join(__dirname, ".data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const ALLOWED_EXTENSIONS = new Set([".excalidraw", ".json"]);

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
};

const ensureDataDir = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
};

const readHistory = async () => {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const writeHistory = async (entries) => {
  await ensureDataDir();
  await fs.writeFile(HISTORY_FILE, JSON.stringify(entries, null, 2), "utf8");
};

const toHistoryEntry = async (filePath, previousEntry = null) => {
  const stats = await fs.stat(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    lastOpenedAt: new Date().toISOString(),
    lastSavedAt: previousEntry?.lastSavedAt || null,
    fileModifiedAt: stats.mtime.toISOString(),
  };
};

const upsertHistoryEntry = async (filePath, transform) => {
  const entries = await readHistory();
  const currentIndex = entries.findIndex((entry) => entry.path === filePath);
  const currentEntry = currentIndex >= 0 ? entries[currentIndex] : null;
  const nextEntry = await transform(currentEntry);
  const remaining = entries.filter((entry) => entry.path !== filePath);
  const nextEntries = [nextEntry, ...remaining].slice(0, 50);
  await writeHistory(nextEntries);
  return nextEntries;
};

const removeHistoryEntry = async (filePath) => {
  const entries = await readHistory();
  const nextEntries = entries.filter((entry) => entry.path !== filePath);
  await writeHistory(nextEntries);
  return nextEntries;
};

const validateFilePath = (filePath) => {
  if (typeof filePath !== "string" || !filePath.trim()) {
    const error = new Error("Missing file path");
    error.statusCode = 400;
    throw error;
  }
  const extension = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    const error = new Error("Only .excalidraw and .json files are supported");
    error.statusCode = 400;
    throw error;
  }
  return filePath;
};

const openNativeFileDialog = async () => {
  if (process.platform === "win32") {
    const script = [
      "Add-Type -AssemblyName System.Windows.Forms",
      "$dialog = New-Object System.Windows.Forms.OpenFileDialog",
      "$dialog.Filter = 'Excalidraw files (*.excalidraw;*.json)|*.excalidraw;*.json|All files (*.*)|*.*'",
      "$dialog.Multiselect = $false",
      "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
      "  $bytes = [System.Text.Encoding]::UTF8.GetBytes($dialog.FileName)",
      "  [Console]::Out.Write([Convert]::ToBase64String($bytes))",
      "}",
    ].join("; ");
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-STA", "-Command", script],
      { windowsHide: true },
    );
    return stdout.trim()
      ? Buffer.from(stdout.trim(), "base64").toString("utf8")
      : "";
  }

  if (process.platform === "darwin") {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      'POSIX path of (choose file with prompt "Open Excalidraw file")',
    ]);
    return stdout.trim();
  }

  const { stdout } = await execFileAsync("zenity", [
    "--file-selection",
    "--title=Open Excalidraw file",
    "--file-filter=Excalidraw files | *.excalidraw *.json",
    "--file-filter=All files | *",
  ]);
  return stdout.trim();
};

const parseBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const readFilePayload = async (filePath) => {
  const content = await fs.readFile(filePath, "utf8");
  return {
    path: filePath,
    name: path.basename(filePath),
    content,
  };
};

const handleError = (response, error) => {
  const statusCode = error?.statusCode || 500;
  sendJson(response, statusCode, {
    error: error?.message || "Unknown error",
  });
};

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || HOST}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  try {
    if (request.method === "GET" && url.pathname === `${API_PREFIX}/health`) {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && url.pathname === `${API_PREFIX}/history`) {
      sendJson(response, 200, { entries: await readHistory() });
      return;
    }

    if (
      request.method === "POST" &&
      url.pathname === `${API_PREFIX}/open-dialog`
    ) {
      const filePath = await openNativeFileDialog();
      if (!filePath) {
        sendJson(response, 200, { cancelled: true });
        return;
      }
      validateFilePath(filePath);
      const history = await upsertHistoryEntry(filePath, (entry) =>
        toHistoryEntry(filePath, entry),
      );
      sendJson(response, 200, {
        cancelled: false,
        file: await readFilePayload(filePath),
        history,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === `${API_PREFIX}/open`) {
      const body = await parseBody(request);
      const filePath = validateFilePath(body.path);
      const history = await upsertHistoryEntry(filePath, (entry) =>
        toHistoryEntry(filePath, entry),
      );
      sendJson(response, 200, {
        file: await readFilePayload(filePath),
        history,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === `${API_PREFIX}/save`) {
      const body = await parseBody(request);
      const filePath = validateFilePath(body.path);
      if (typeof body.content !== "string") {
        const error = new Error("Missing file content");
        error.statusCode = 400;
        throw error;
      }
      await fs.writeFile(filePath, body.content, "utf8");
      const history = await upsertHistoryEntry(filePath, async (entry) => {
        const nextEntry = await toHistoryEntry(filePath, entry);
        return {
          ...nextEntry,
          lastSavedAt: new Date().toISOString(),
        };
      });
      sendJson(response, 200, {
        ok: true,
        history,
      });
      return;
    }

    if (
      request.method === "DELETE" &&
      url.pathname === `${API_PREFIX}/history`
    ) {
      const filePath = validateFilePath(url.searchParams.get("path"));
      sendJson(response, 200, {
        ok: true,
        history: await removeHistoryEntry(filePath),
      });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    handleError(response, error);
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `Local file service listening on http://${HOST}:${PORT}\n`,
  );
});
