import { useState, type ReactNode } from "react";

export type Theme = "system" | "light" | "dark";

export interface View {
  id: string;
  label: string;
  render: () => ReactNode;
}

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

/** Applies a theme to the document: `system` follows the operating system. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/**
 * The Studio's frame (studio-SHELL-000001): a skip link, a banner with the
 * project's name, a navigation between views, a theme switch and the main
 * region. Every control is a button, so the keyboard reaches and operates
 * all of it; the current view is marked for assistive technology.
 */
export function Shell({
  project,
  views,
  initialView,
  initialTheme = "system",
  onTheme = applyTheme,
}: {
  project: string;
  views: View[];
  initialView?: string;
  initialTheme?: Theme;
  onTheme?: (theme: Theme) => void;
}) {
  const [current, setCurrent] = useState(initialView ?? views[0].id);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const view = views.find((v) => v.id === current) ?? views[0];

  const pickTheme = (next: Theme) => {
    setTheme(next);
    onTheme(next);
  };

  return (
    <>
      <a className="skip-link" href="#studio-main">
        Skip to content
      </a>
      <header className="studio-header">
        <h1>{project}</h1>
        <nav className="studio-nav" aria-label="Views">
          <ul>
            {views.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  aria-current={v.id === view.id ? "page" : undefined}
                  onClick={() => {
                    setCurrent(v.id);
                  }}
                >
                  {v.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="theme-switch" role="group" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === theme}
              onClick={() => {
                pickTheme(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <main id="studio-main" tabIndex={-1}>
        {view.render()}
      </main>
    </>
  );
}
