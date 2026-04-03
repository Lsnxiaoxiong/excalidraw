import { Sidebar } from "@excalidraw/excalidraw";
import {
  file,
  historyIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";
import clsx from "clsx";
import React from "react";

import "./LocalFileSidebar.scss";

import type { LocalFileHistoryEntry } from "../local-files/api";

type Props = {
  historyEntries: LocalFileHistoryEntry[];
  currentFilePath: string | null;
  isBackendAvailable: boolean;
  isBusy: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  onOpenDialog: () => void;
  onOpenHistoryFile: (filePath: string) => void;
  onDeleteHistoryFile: (filePath: string) => void;
  onSaveNow: () => void;
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "未保存";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const saveStateLabelMap: Record<Props["saveState"], string> = {
  idle: "未连接到文件",
  saving: "正在实时保存",
  saved: "已保存",
  error: "保存失败",
};

export const LocalFileSidebar = ({
  historyEntries,
  currentFilePath,
  isBackendAvailable,
  isBusy,
  saveState,
  onOpenDialog,
  onOpenHistoryFile,
  onDeleteHistoryFile,
  onSaveNow,
}: Props) => {
  return (
    <Sidebar name="localFiles" docked={false} className="local-files-sidebar">
      <Sidebar.Header>
        <div className="local-files-sidebar__heading">
          <div className="local-files-sidebar__title">历史文件</div>
          <div
            className={clsx("local-files-sidebar__status", {
              "is-error": saveState === "error" || !isBackendAvailable,
            })}
          >
            {isBackendAvailable
              ? saveStateLabelMap[saveState]
              : "后端服务未连接"}
          </div>
        </div>
      </Sidebar.Header>

      <div className="local-files-sidebar__body">
        <div className="local-files-sidebar__actions">
          <button
            className="local-files-sidebar__primary"
            onClick={onOpenDialog}
            disabled={isBusy || !isBackendAvailable}
            type="button"
          >
            <span>{file}</span>
            打开本地文件
          </button>
          <button
            className="local-files-sidebar__secondary"
            onClick={onSaveNow}
            disabled={!currentFilePath || isBusy || !isBackendAvailable}
            type="button"
          >
            立即保存
          </button>
        </div>

        <div className="local-files-sidebar__current">
          <div className="local-files-sidebar__section-label">当前文件</div>
          <div className="local-files-sidebar__current-path">
            {currentFilePath || "尚未打开本地文件"}
          </div>
        </div>

        <div className="local-files-sidebar__list-header">
          <span>{historyIcon}</span>
          <span>最近打开</span>
        </div>

        {historyEntries.length === 0 ? (
          <div className="local-files-sidebar__empty">暂无历史文件</div>
        ) : (
          <div className="local-files-sidebar__list">
            {historyEntries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className={clsx("local-files-sidebar__entry", {
                  "is-active": entry.path === currentFilePath,
                })}
                onClick={() => onOpenHistoryFile(entry.path)}
                disabled={!isBackendAvailable}
              >
                <div className="local-files-sidebar__entry-main">
                  <div className="local-files-sidebar__entry-name">
                    {entry.name}
                  </div>
                  <div className="local-files-sidebar__entry-path">
                    {entry.path}
                  </div>
                  <div className="local-files-sidebar__entry-meta">
                    打开于 {formatDateTime(entry.lastOpenedAt)} · 保存于{" "}
                    {formatDateTime(entry.lastSavedAt)}
                  </div>
                </div>
                <span
                  className="local-files-sidebar__delete"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeleteHistoryFile(entry.path);
                  }}
                >
                  {TrashIcon}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sidebar>
  );
};
