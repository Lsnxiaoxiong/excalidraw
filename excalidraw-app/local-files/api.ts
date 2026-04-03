export type LocalFileHistoryEntry = {
  path: string;
  name: string;
  lastOpenedAt: string;
  lastSavedAt: string | null;
  fileModifiedAt: string;
};

type LocalFileApiResponse<T> = T & {
  error?: string;
};

type LocalFilePayload = {
  path: string;
  name: string;
  content: string;
};

type OpenFileResponse = {
  cancelled?: boolean;
  file: LocalFilePayload;
  history: LocalFileHistoryEntry[];
};

type HistoryResponse = {
  entries: LocalFileHistoryEntry[];
};

type SaveResponse = {
  ok: boolean;
  history: LocalFileHistoryEntry[];
};

const API_ROOT =
  import.meta.env.VITE_FILE_SERVICE_URL ||
  "http://127.0.0.1:4318/api/local-files";

const request = async <T>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_ROOT}${input}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const payload = (await response.json()) as LocalFileApiResponse<T>;
  if (!response.ok || payload.error) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
};

export const checkLocalFileService = async () => {
  await request<{ ok: true }>("/health", {
    method: "GET",
  });
};

export const getLocalFileHistory = async () => {
  const payload = await request<HistoryResponse>("/history", {
    method: "GET",
  });
  return payload.entries;
};

export const openLocalFileDialog = async () => {
  return request<OpenFileResponse>("/open-dialog", {
    method: "POST",
    body: JSON.stringify({}),
  });
};

export const openLocalFileByPath = async (filePath: string) => {
  return request<OpenFileResponse>("/open", {
    method: "POST",
    body: JSON.stringify({ path: filePath }),
  });
};

export const saveLocalFile = async (filePath: string, content: string) => {
  return request<SaveResponse>("/save", {
    method: "POST",
    body: JSON.stringify({ path: filePath, content }),
  });
};

export const removeLocalFileHistoryEntry = async (filePath: string) => {
  const payload = await request<{ ok: true; history: LocalFileHistoryEntry[] }>(
    `/history?path=${encodeURIComponent(filePath)}`,
    {
      method: "DELETE",
    },
  );
  return payload.history;
};
