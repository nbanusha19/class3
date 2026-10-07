export type AppRoute =
  | { view: "dashboard" }
  | { view: "editor"; reportId: string; form?: string };

function formFromSearch(search: string): string | undefined {
  const form = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("form")?.trim();
  return form || undefined;
}

export function readAppRoute(): AppRoute {
  const { pathname, search } = window.location;
  const parts = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts[0] === "reports" && parts[1]) {
    return { view: "editor", reportId: decodeURIComponent(parts[1]), form: formFromSearch(search) };
  }
  return { view: "dashboard" };
}

export function writeAppRoute(route: AppRoute, replace = false) {
  let path = "/";
  if (route.view === "editor") {
    path = `/reports/${encodeURIComponent(route.reportId)}`;
    if (route.form) path += `?form=${encodeURIComponent(route.form)}`;
  }
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === path) return;
  const fn = replace ? window.history.replaceState : window.history.pushState;
  fn.call(window.history, route, "", path);
}

export function editorFormId(): string | undefined {
  const route = readAppRoute();
  return route.view === "editor" ? route.form : undefined;
}
