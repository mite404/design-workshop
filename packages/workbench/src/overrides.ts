// The override file (packages/catalog/src/overrides.css, ADR-002): the one stylesheet the
// Workbench writes. It writes the shape itself, so it reads it back line by line and refuses any
// other shape rather than repairing it: comment lines, then a `:root` block, then one block per
// selector, each value on its own line with a two-space indent.

const ROOT = ":root";
const COMMENT = /^\/\*.*\*\/$/;
const OPEN = /^([^\s{};](?:[^{};\n]*[^\s{};])?) \{$/;
const DECL = /^ {2}([^\s:;{}]+): ([^\s;{}](?:[^;{}\n]*[^\s;{}])?);$/;

export type Position = [block: number, property: number];

// One block of the file: its selector, the lines of its braces, and each value with its line.
type Block = {
  selector: string;
  open: number;
  close: number;
  values: Map<string, { line: number; value: string }>;
};

function fail(i: number, expected: string): never {
  throw new Error(`override file line ${i + 1}: ${expected}`);
}

function openBlock(line: string, i: number, blocks: Block[]): Block {
  const selector = OPEN.exec(line)?.[1]; // "aside {" → "aside"
  if (selector === undefined) fail(i, 'expected a selector and " {"');
  const misplaced =
    blocks.length === 0 ? selector !== ROOT : blocks.some((b) => b.selector === selector);
  if (misplaced) fail(i, "the :root block comes first and each selector appears once");
  return { selector, open: i, close: -1, values: new Map() };
}

function closeBlock(block: Block, i: number): Block {
  if (block.values.size === 0 && block.selector !== ROOT) {
    fail(i, "only the :root block may be empty");
  }
  return { ...block, close: i };
}

function addValue(block: Block, line: string, i: number): void {
  const [, name, value] = DECL.exec(line) ?? []; // "  gap: 4px;" → ["gap", "4px"]
  if (name === undefined || value === undefined || block.values.has(name)) {
    fail(i, 'expected one new "  name: value;"');
  }
  block.values.set(name, { line: i, value });
}

function scan(text: string): { lines: string[]; blocks: Block[] } {
  const lines = text.split("\n"); // string → string[], the last one "" after the final newline
  if (lines.pop() !== "") fail(lines.length, "must end with a newline");
  const blocks: Block[] = [];
  let block: Block | undefined;
  for (const [i, line] of lines.entries()) {
    if (block === undefined) {
      if (blocks.length > 0 || !COMMENT.test(line)) block = openBlock(line, i, blocks);
    } else if (line === "}") {
      blocks.push(closeBlock(block, i));
      block = undefined;
    } else {
      addValue(block, line, i);
    }
  }
  if (block !== undefined || blocks.length === 0) {
    fail(lines.length, "needs a :root block and a closing }");
  }
  return { lines, blocks };
}

// Writes `name: value` over its own line, after the block's last value, or in a new last block.
function writeValue(
  lines: string[],
  block: Block | undefined,
  at: number | undefined,
  selector: string,
  line: string,
): void {
  if (!DECL.test(line) || !OPEN.test(`${selector} {`)) {
    throw new Error(`override file: cannot write "${selector}" "${line}"`);
  }
  if (block === undefined) lines.push(`${selector} {`, line, "}");
  else if (at === undefined) lines.splice(block.close, 0, line);
  else lines[at] = line;
}

// Removes the value's line, or its whole block when it was the last one, except :root's.
function removeValue(lines: string[], block: Block, at: number): void {
  const emptied = block.values.size === 1 && block.selector !== ROOT;
  lines.splice(emptied ? block.open : at, emptied ? 3 : 1);
}

/**
 * The values in an override file, by selector then property name, in file order.
 * @throws when `text` is not in the shape the Workbench writes.
 */
export function parseOverrides(text: string): Map<string, Map<string, string>> {
  return new Map(
    scan(text).blocks.map((b) => [
      b.selector,
      new Map([...b.values].map(([n, v]) => [n, v.value])),
    ]),
  );
}

/**
 * `text` with one value set, or removed when `value` is null. Every other byte is kept. A new
 * selector's block goes last; a selector's block goes once its last value is removed, except
 * `:root`'s, which stays empty.
 * @param position The original block and property offsets when restoring a removed value.
 * @throws when `text` is malformed, or when the selector, name or value would not fit one line.
 */
export function setOverride(
  text: string,
  selector: string,
  name: string,
  value: string | null,
  position?: Position,
): string {
  const { lines, blocks } = scan(text);
  const block = blocks.find((b) => b.selector === selector);
  const at = block?.values.get(name)?.line;
  if (value !== null && at === undefined && position !== undefined) {
    const line = `  ${name}: ${value};`;
    if (!DECL.test(line) || !OPEN.test(`${selector} {`)) throw new Error("invalid override");
    if (block === undefined) {
      const next = blocks[Math.max(1, position[0])];
      lines.splice(next?.open ?? lines.length, 0, `${selector} {`, line, "}");
    } else {
      const next = [...block.values.values()][position[1]];
      lines.splice(next?.line ?? block.close, 0, line);
    }
  } else if (value !== null) writeValue(lines, block, at, selector, `  ${name}: ${value};`);
  else if (block !== undefined && at !== undefined) removeValue(lines, block, at);
  return `${lines.join("\n")}\n`;
}
