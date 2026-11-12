// The project contract (ADR-029): what a project file must contain, as data, and the pure check
// that decides acceptance. No agent, model or network call takes part; the failure list alone
// is the decision, and an empty list accepts.
import CONTRACT from "./contract.json" with { type: "json" };

/** The contract's shape, as contract.json holds it. */
export type Contract = typeof CONTRACT;

/** One reason a project is refused: a stable code, the path it concerns and a sentence. */
export type Failure = { code: string; path: string; message: string };

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];

// The failures of a parsed manifest's Storybook and shell parts.
function checkStorybook(data: Record<string, unknown>, contract: Contract): Failure[] {
  const storybook = record(data.storybook) ? data.storybook : {};
  const failures: Failure[] = [];
  if (storybook.version !== contract.storybook)
    failures.push({
      code: "storybook-version",
      path: "storybook/version",
      message: `Storybook must be exactly ${contract.storybook}, not ${String(storybook.version)}.`,
    });
  if (storybook.indexVersion !== contract.indexVersion)
    failures.push({
      code: "index-version",
      path: "storybook/indexVersion",
      message: `The Storybook index must be format ${contract.indexVersion}.`,
    });
  return failures;
}

// The failures of the slots, components and surfaces a shell kind requires.
function checkShell(
  data: Record<string, unknown>,
  shell: Contract["shells"][keyof Contract["shells"]],
  contract: Contract,
): Failure[] {
  const slots = new Set(strings(data.slots));
  const components = record(data.components) ? data.components : {};
  const stories = (name: string) =>
    strings(record(components[name]) ? components[name].stories : []);
  return [
    ...shell.slots
      .filter((slot) => !slots.has(slot))
      .map((slot) => ({
        code: "missing-slot",
        path: `slots/${slot}`,
        message: `No ${slot} slot.`,
      })),
    ...shell.components.flatMap((name): Failure[] =>
      !Object.hasOwn(components, name)
        ? [{ code: "missing-component", path: `components/${name}`, message: `No ${name}.` }]
        : stories(name).length === 0
          ? [
              {
                code: "missing-story",
                path: `components/${name}/stories`,
                message: `${name} has no story.`,
              },
            ]
          : [],
    ),
    ...strings(data.surfaces).flatMap((surface): Failure[] => {
      const spec: { component?: string; colour: string } | undefined = new Map<
        string,
        { component?: string; colour: string }
      >(Object.entries(contract.surfaces)).get(surface);
      if (spec === undefined)
        return [
          {
            code: "unknown-surface",
            path: `surfaces/${surface}`,
            message: `No surface ${surface}.`,
          },
        ];
      return spec.component === undefined || Object.hasOwn(components, spec.component)
        ? []
        : [
            {
              code: "surface-component",
              path: `surfaces/${surface}`,
              message: `The ${surface} surface needs ${spec.component}.`,
            },
          ];
    }),
  ];
}

/**
 * The contract surface a selection draws: the first of its `data-wb` names, nearest first, that a
 * surface names as its component, else the surface with no component (the page).
 */
export function surfaceOf(
  names: string[],
  contract: Contract = CONTRACT,
): { surface: string; colour: string } | null {
  const specs: [string, { component?: string; colour: string }][] = Object.entries(
    contract.surfaces,
  );
  const found =
    names.flatMap((name) => specs.filter(([, spec]) => spec.component === name))[0] ??
    specs.find(([, spec]) => spec.component === undefined);
  return found === undefined ? null : { surface: found[0], colour: found[1].colour };
}

/**
 * What a manifest is read from: the installed Storybook version, Storybook's index, the slots the
 * source declares, and each `data-wb` name with the file that declares it.
 */
export type Sources = {
  version: string;
  index: unknown;
  slots: string[];
  names: Map<string, string>;
};

/**
 * The manifest describing `sources` in the contract's terms. A name's stories are the index's
 * stories whose `componentPath` is the file that declares it. The shell is `app-shell` when every
 * slot it needs is present, otherwise `full-screen`; surfaces are those whose component is present.
 */
export function manifestOf(sources: Sources, contract: Contract = CONTRACT) {
  const index = record(sources.index) ? sources.index : {};
  const entries = Object.entries(record(index.entries) ? index.entries : {});
  const storiesOf = (file: string) =>
    entries
      .filter(
        ([, e]) => record(e) && e.type === "story" && String(e.componentPath).endsWith(`/${file}`),
      )
      .map(([id]) => id)
      .toSorted();
  const slots = [...new Set(sources.slots)].toSorted();
  return {
    format: "design-workshop/manifest",
    version: 1,
    storybook: { version: sources.version, indexVersion: index.v },
    shell: contract.shells["app-shell"].slots.every((s) => slots.includes(s))
      ? "app-shell"
      : "full-screen",
    slots,
    components: Object.fromEntries(
      [...sources.names]
        .toSorted(([a], [b]) => (a < b ? -1 : 1))
        .map(([name, file]) => [name, { stories: storiesOf(file) }]),
    ),
    surfaces: Object.entries(contract.surfaces)
      .filter(([, spec]) => !("component" in spec) || sources.names.has(spec.component))
      .map(([surface]) => surface),
  };
}

/**
 * Every reason the manifest `text` breaks `contract`, sorted by path then code. An empty list
 * accepts it. The same text always gives the same list.
 */
export function validate(text: string, contract: Contract = CONTRACT): Failure[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [{ code: "not-json", path: "", message: "The manifest is not JSON." }];
  }
  if (!record(data) || data.format !== "design-workshop/manifest" || data.version !== 1)
    return [
      { code: "bad-format", path: "format", message: "Not a design-workshop/manifest, version 1." },
    ];
  const shell = new Map(Object.entries(contract.shells)).get(String(data.shell));
  const failures = [
    ...checkStorybook(data, contract),
    ...(shell === undefined
      ? [{ code: "unknown-shell", path: "shell", message: `No shell kind ${String(data.shell)}.` }]
      : checkShell(data, shell, contract)),
  ];
  // Code-unit order, not localeCompare, so the list does not depend on the machine's locale.
  const key = (f: Failure) => `${f.path}\u0000${f.code}`;
  return failures.toSorted((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/** One line of a project's checklist: a contract item and its failure, when it has one. */
export type CheckItem = { path: string; failure?: Failure };

// Each override value is a string, under a selector, as the override file holds them. Whether a
// value is one the Workbench may write is the load's own check, on the plugin's save path.
function checkOverrides(overrides: unknown): Failure[] {
  const blocks = record(overrides) ? Object.entries(overrides) : null;
  const bad =
    blocks === null ||
    blocks.some(
      ([, values]) => !record(values) || Object.values(values).some((v) => typeof v !== "string"),
    );
  return bad
    ? [
        {
          code: "bad-overrides",
          path: "overrides",
          message: "Overrides must map selectors to string values.",
        },
      ]
    : [];
}

/**
 * The checklist for project file `text`: every item the contract asks of it, each with its
 * failure when it has one, and any other failure after them. It is accepted when no item has a
 * failure. The same text always gives the same list (ADR-029).
 */
export function checkProject(text: string, contract: Contract = CONTRACT): CheckItem[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [
      { path: "", failure: { code: "not-json", path: "", message: "The file is not JSON." } },
    ];
  }
  if (!record(data) || data.format !== "design-workshop/project" || data.version !== 1)
    return [
      {
        path: "format",
        failure: {
          code: "bad-format",
          path: "format",
          message: "Not a design-workshop/project, version 1.",
        },
      },
    ];
  const failures = [
    ...validate(JSON.stringify(data.manifest), contract),
    ...checkOverrides(data.overrides),
  ];
  const manifest = record(data.manifest) ? data.manifest : {};
  const shell = new Map(Object.entries(contract.shells)).get(String(manifest.shell));
  const paths = [
    "storybook/version",
    "storybook/indexVersion",
    "shell",
    ...(shell?.slots.map((s) => `slots/${s}`) ?? []),
    ...(shell?.components.map((c) => `components/${c}`) ?? []),
    "overrides",
  ];
  const owner = (f: Failure) => paths.find((p) => f.path === p || f.path.startsWith(`${p}/`));
  return [
    ...paths.map((path) => {
      const failure = failures.find((f) => owner(f) === path);
      return failure === undefined ? { path } : { path, failure };
    }),
    ...failures
      .filter((f) => owner(f) === undefined)
      .map((failure) => ({ path: failure.path, failure })),
  ];
}
