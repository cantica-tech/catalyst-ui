import type { FrameworkVersionInfo } from "catalyst-core";
import { useState } from "react";
import { VersionControlIcon } from "./VersionControlIcon.js";

export interface FrameworkVersionHeaderProps {
  versionInfo?: FrameworkVersionInfo;
}

export function FrameworkVersionHeader({
  versionInfo,
}: FrameworkVersionHeaderProps) {
  const meets = versionInfo ? versionInfo.meetsRequirement : true;
  const [open, setOpen] = useState(!meets);

  const versionDisplay = versionInfo?.version ?? "Unknown";
  const requiredDisplay = versionInfo?.requiredVersion ?? ">=0.31.0";
  const explanation =
    versionInfo?.explanation ||
    (!meets
      ? `Framework version ${versionDisplay} does not match expected version requirement (${requiredDisplay}).`
      : `Framework version ${versionDisplay} meets expected requirement (${requiredDisplay}).`);

  return (
    <header
      style={{
        borderBottom: "1px solid var(--vscode-panel-border, #808080)",
        padding: "8px 12px",
        marginBottom: "12px",
        backgroundColor:
          "var(--vscode-sideBar-background, rgba(127, 127, 127, 0.05))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            title="Toggle Catalyst Framework Version Info"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
              cursor: "pointer",
              borderRadius: "4px",
              border: meets
                ? "1px solid var(--vscode-button-border, transparent)"
                : "1px solid #ef4444",
              backgroundColor: meets
                ? "var(--vscode-button-secondaryBackground, #3a3d41)"
                : "#7f1d1d",
              color: meets
                ? "var(--vscode-button-secondaryForeground, #ffffff)"
                : "#fca5a5",
              fontWeight: 500,
              fontSize: "12px",
            }}
          >
            <VersionControlIcon
              size={14}
              fill={meets ? "currentColor" : "#fca5a5"}
            />
            <span>Framework Version</span>
            {!meets ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: "bold",
                  marginLeft: "4px",
                }}
              >
                !
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {open ? (
        <div
          style={{
            marginTop: "8px",
            padding: "8px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            lineHeight: "1.4",
            backgroundColor: meets
              ? "var(--vscode-inputValidation-infoBackground, rgba(16, 185, 129, 0.1))"
              : "rgba(239, 68, 68, 0.15)",
            border: meets
              ? "1px solid var(--vscode-inputValidation-infoBorder, #10b981)"
              : "1px solid #ef4444",
            color: meets
              ? "var(--vscode-inputValidation-infoForeground, #34d399)"
              : "#f87171",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            {!meets ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  fontWeight: "bold",
                  flexShrink: 0,
                  marginTop: "1px",
                }}
              >
                !
              </span>
            ) : null}
            <div>
              <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>
                Catalyst Framework Version: {versionDisplay} (Expected: {requiredDisplay})
              </p>
              <p style={{ margin: 0 }}>{explanation}</p>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
