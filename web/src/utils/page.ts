export function queryValue(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

export function setPageMetadata(
  title: string,
  themeColor: string,
  options: { description?: string; robots?: string; referrer?: string } = {},
): void {
  document.title = title;
  setMeta("name", "theme-color", themeColor);
  setOptionalMeta("name", "description", options.description);
  setOptionalMeta("name", "robots", options.robots);
  setOptionalMeta("name", "referrer", options.referrer);
}

function setOptionalMeta(attribute: "name", value: string, content?: string): void {
  const selector = `meta[${attribute}="${value}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);

  if (content === undefined) {
    existing?.remove();
    return;
  }

  setMeta(attribute, value, content);
}

function setMeta(attribute: "name", value: string, content: string): void {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${value}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, value);
    document.head.append(meta);
  }
  meta.content = content;
}
