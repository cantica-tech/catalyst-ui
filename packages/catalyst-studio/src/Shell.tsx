import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "system" | "light" | "dark";

export interface View {
  id: string;
  label: string;
  /** `target`: what another view asked this one to open (an entity's ID), if any. */
  render: (target?: string) => ReactNode;
  /** Ctrl/⌘ with this key opens the view from anywhere, then focuses the element with id `focus`. */
  shortcut?: { key: string; focus: string };
}

const THEMES: { id: Theme; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

/** Opens a view, with what it should open (`navigate("artifacts", "REQ-000001")`). */
export type Navigate = (view: string, target?: string) => void;

const NavigateContext = createContext<Navigate>(() => undefined);

/** How a view opens another: the shell's navigation, or nothing outside a shell. */
export function useNavigate(): Navigate {
  return useContext(NavigateContext);
}

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
  const [focusNext, setFocusNext] = useState<string | null>(null);
  // a navigation remounts the view with its target, even to the same view
  const [target, setTarget] = useState<{ value?: string; n: number }>({ n: 0 });
  const navigate: Navigate = (viewId, value) => {
    setCurrent(viewId);
    setTarget((t) => ({ value, n: t.n + 1 }));
    if (value) setFocusNext("studio-main"); // a link to another view lands the reader on it
  };
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const view = views.find((v) => v.id === current) ?? views[0];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const wanted = views.find((v) => v.shortcut?.key === event.key.toLowerCase());
      if (!wanted?.shortcut) return;
      event.preventDefault();
      setCurrent(wanted.id);
      setFocusNext(wanted.shortcut.focus);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [views]);

  useEffect(() => {
    if (!focusNext) return;
    const element = document.getElementById(focusNext);
    if (element) {
      element.focus();
      setFocusNext(null);
    }
  }); // after every render: the view may show its element only once it has loaded

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
                    navigate(v.id);
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
      <main id="studio-main" tabIndex={-1} key={`${view.id}:${String(target.n)}`}>
        <NavigateContext.Provider value={navigate}>{view.render(target.value)}</NavigateContext.Provider>
      </main>
    </>
  );
}
