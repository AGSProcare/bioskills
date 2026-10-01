// Exact versions substituted for `<pkg>@latest` in docs and synced skills.
export const PINS = {
  "@agent-native/core": "0.198.8",
  "@agent-native/skills": "0.3.20",
  ccusage: "20.0.26",
  skills: "1.7.0",
};

const LATEST = /(?<![\w@/.-])((?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*)@latest(?![\w-]|\.\w)/gi;

export const PINNABLE_EXTENSIONS = new Set([".md", ".json", ".yml", ".yaml"]);

export function applyPins(text) {
  return text.replace(LATEST, (match, name) =>
    PINS[name] ? `${name}@${PINS[name]}` : match,
  );
}

export function findUnpinned(text) {
  return [...text.matchAll(LATEST)].map((m) => m[0]);
}
