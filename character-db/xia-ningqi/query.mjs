// 夏柠柒人物数据库查询工具
// Node 标准库 only，不联网，不写任何文件，只读本目录的 JSON。
// 用法：
//   node query.mjs <关键词> [--type lines|inner|events|traits|relationships|rules|arc|profile|flags]
//                         [--chapter 107 | --chapter 131-165 | --chapter 151a]
//                         [--addressee 祁南] [--emotion 吃醋] [--stage early|mid|late]
//                         [--limit N] [--json]
//   node query.mjs --stats
//   node query.mjs --type lines --chapter 107        （无关键词时按条件列出）
//
// 分词：中文按重叠 bigram + 短词整词 + 单字（高频虚字不作单字索引），
// 与记忆插件的 tokenize 思路同源、为本库（小说底子、非对话记忆）重写。
// 排序：关键词命中权重（tags > text > 其余字段）+ 短语整词加分，
// 按分数降序、同分按章节升序。

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- 分词
const CJK_RUN =
  /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}\u{2ceb0}-\u{2ebef}\u{30000}-\u{3134a}]+/gu;
const WORD_RUN = /[a-z0-9]+(?:[.'-][a-z0-9]+)*/g;

// 高频虚字：作单字 token 时几乎每条都命中，排除；仍可通过 bigram 与整词命中。
const CJK_SINGLE_STOP = new Set([
  "的", "了", "在", "是", "有", "和", "就", "都", "也", "还",
  "不", "没", "很", "这", "那", "我", "你", "他", "她", "它", "们",
  "个", "一", "上", "下", "来", "去", "吗", "呢", "吧", "啊", "哦",
  "嗯", "呀", "么",
]);

function tokenize(text) {
  if (typeof text !== "string") return [];
  const out = new Set();
  for (const m of text.toLowerCase().matchAll(WORD_RUN)) out.add(m[0]);
  for (const m of text.matchAll(CJK_RUN)) {
    const run = m[0];
    if (run.length > 1 && run.length <= 6) out.add(run);
    for (const ch of run) {
      if (!CJK_SINGLE_STOP.has(ch)) out.add(ch);
    }
    for (let i = 0; i + 1 < run.length; i++) out.add(run.slice(i, i + 2));
  }
  return [...out];
}

// ---------------------------------------------------------------- 读库
const TYPE_ALIASES = {
  lines: "lines",
  line: "lines",
  inner: "inner_monologues",
  inner_monologues: "inner_monologues",
  events: "key_events",
  key_events: "key_events",
  traits: "traits",
  relationships: "relationships",
  rules: "speech_rules",
  speech_rules: "speech_rules",
  arc: "growth_arc",
  growth_arc: "growth_arc",
  profile: "profile",
  flags: "flags",
};

function flattenStrings(value, out) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => flattenStrings(v, out));
  else if (value && typeof value === "object") {
    for (const v of Object.values(value)) flattenStrings(v, out);
  }
  return out;
}

function loadEntries() {
  const entries = [];
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .sort();
  for (const file of files) {
    const data = JSON.parse(readFileSync(join(DIR, file), "utf8"));
    if (data.profile) {
      // profile.json 是单对象：展平成一条可检索记录。
      const flat = flattenStrings(data.profile, []).join(" / ");
      entries.push({
        id: "profile",
        type: "profile",
        chapter: null,
        chapter_label: null,
        chapter_range: null,
        stage: null,
        addressee: null,
        emotion: [],
        tags: ["档案", "夏柠柒", "夏芊芊"],
        text: flat,
        scene: null,
        source: "v2.4-portrayal",
        file: basename(file),
        raw: data.profile,
      });
      continue;
    }
    for (const e of data.entries ?? []) {
      const other = [];
      for (const k of ["person", "relation", "rule", "trait", "title", "event", "range_label", "flag_type", "status"]) {
        if (typeof e[k] === "string") other.push(e[k]);
      }
      entries.push({
        id: e.id,
        type: e.type ?? data.collection,
        chapter: e.chapter ?? null,
        chapter_label: e.chapter_label ?? null,
        chapter_range: e.chapter_range ?? null,
        stage: e.stage ?? null,
        addressee: e.addressee ?? null,
        emotion: e.emotion ?? [],
        tags: e.tags ?? [],
        text: e.text ?? "",
        scene: e.scene ?? null,
        source: e.source ?? "",
        file: basename(file),
        other: other.join(" / "),
        raw: e,
      });
    }
  }
  return entries;
}

// ---------------------------------------------------------------- 过滤
function parseChapterSpec(spec) {
  const s = String(spec).trim().toLowerCase();
  const range = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) return { kind: "range", min: +range[1], max: +range[2] };
  const label = s.match(/^(\d+)([a-z])$/);
  if (label) return { kind: "label", num: +label[1], label: s };
  const num = s.match(/^(\d+)$/);
  if (num) return { kind: "num", num: +num[1] };
  return { kind: "unknown", raw: s };
}

function chapterMatches(entry, spec) {
  const { kind, num, min, max, label } = spec;
  const ch = entry.chapter;
  const range = entry.chapter_range;
  if (kind === "label") {
    return (entry.chapter_label ?? "").toLowerCase() === label;
  }
  if (kind === "num") {
    if (ch === num) return true;
    if (range && num >= range[0] && num <= range[1]) return true;
    return false;
  }
  if (kind === "range") {
    if (ch !== null && ch >= min && ch <= max) return true;
    if (range && range[0] <= max && range[1] >= min) return true;
    return false;
  }
  return false;
}

function applyFilters(entries, opts) {
  return entries.filter((e) => {
    if (opts.type && e.type !== opts.type) return false;
    if (opts.chapter && !chapterMatches(e, parseChapterSpec(opts.chapter))) return false;
    if (opts.addressee && e.addressee !== opts.addressee) return false;
    if (opts.emotion && !(e.emotion ?? []).includes(opts.emotion)) return false;
    if (opts.stage && e.stage !== opts.stage) return false;
    return true;
  });
}

// ---------------------------------------------------------------- 打分
function scoreEntry(entry, queryTokens, queryRaw) {
  const tagTokens = new Set(tokenize((entry.tags ?? []).join(" ")));
  const textTokens = new Set(tokenize(entry.text));
  const otherTokens = new Set(tokenize([entry.scene, entry.other].filter(Boolean).join(" ")));
  let score = 0;
  for (const t of queryTokens) {
    if (tagTokens.has(t)) score += 3;
    else if (textTokens.has(t)) score += 2;
    else if (otherTokens.has(t)) score += 1;
  }
  // 短语整词加分：查询原串完整出现在正文或标签里。
  if (queryRaw.length >= 2) {
    if (entry.text.includes(queryRaw)) score += 5;
    if ((entry.tags ?? []).join(" ").includes(queryRaw)) score += 5;
  }
  return score;
}

// ---------------------------------------------------------------- 输出
function formatEntry(e, score) {
  const head = [
    `[${score}]`,
    e.type,
    e.id,
    e.chapter_label ? `ch.${e.chapter_label}` : e.chapter !== null ? `ch.${e.chapter}` : e.chapter_range ? `ch.${e.chapter_range[0]}-${e.chapter_range[1]}` : "",
    e.stage ?? "",
    e.addressee ? `对${e.addressee}` : "",
    (e.emotion ?? []).length ? `[${e.emotion.join(",")}]` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const lines = [head];
  if (e.scene) lines.push(`  场景：${e.scene}`);
  lines.push(`  ${e.text}`);
  if (e.source) lines.push(`  来源：${e.source}`);
  return lines.join("\n");
}

function printHelp() {
  console.log(`夏柠柒人物数据库查询工具（Node 标准库 only，不联网）
用法：
  node query.mjs <关键词> [--type <集合>] [--chapter 107|131-165|151a]
                        [--addressee 祁南] [--emotion 吃醋] [--stage early|mid|late]
                        [--limit N] [--json]
  node query.mjs --stats
  node query.mjs --type lines --chapter 107        无关键词时按条件列出
集合：lines / inner / events / traits / relationships / rules / arc / profile / flags`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }
  const opts = { limit: null, json: false, stats: false };
  const queryParts = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") opts.json = true;
    else if (a === "--stats") opts.stats = true;
    else if (a === "--type") opts.type = TYPE_ALIASES[argv[++i]] ?? argv[i];
    else if (a === "--chapter") opts.chapter = argv[++i];
    else if (a === "--addressee") opts.addressee = argv[++i];
    else if (a === "--emotion") opts.emotion = argv[++i];
    else if (a === "--stage") opts.stage = argv[++i];
    else if (a === "--limit") opts.limit = parseInt(argv[++i], 10) || null;
    else if (a.startsWith("--")) {
      console.error(`未知参数：${a}`);
      process.exit(2);
    } else queryParts.push(a);
  }

  const entries = loadEntries();

  if (opts.stats) {
    const counts = {};
    for (const e of entries) counts[e.type] = (counts[e.type] ?? 0) + 1;
    const chapters = entries.map((e) => e.chapter).filter((c) => c !== null);
    console.log(JSON.stringify({
      character: "xia-ningqi",
      total: entries.length,
      collections: counts,
      chapter_coverage: { min: Math.min(...chapters), max: Math.max(...chapters) },
      schema_version: "1.0.0",
    }, null, 2));
    return;
  }

  const queryRaw = queryParts.join(" ").trim();
  let pool = applyFilters(entries, opts);
  let results;
  if (queryRaw) {
    const queryTokens = tokenize(queryRaw);
    results = pool
      .map((e) => ({ e, score: scoreEntry(e, queryTokens, queryRaw) }))
      .filter((r) => r.score > 0)
      .sort((a, b) =>
        b.score - a.score ||
        (a.e.chapter ?? 9999) - (b.e.chapter ?? 9999) ||
        String(a.e.id).localeCompare(String(b.e.id)),
      );
  } else {
    results = pool
      .map((e) => ({ e, score: 0 }))
      .sort((a, b) =>
        (a.e.chapter ?? 9999) - (b.e.chapter ?? 9999) ||
        String(a.e.id).localeCompare(String(b.e.id)),
      );
  }
  const limit = opts.limit ?? (queryRaw ? 10 : 20);
  results = results.slice(0, limit);

  if (opts.json) {
    console.log(JSON.stringify(results.map((r) => ({ ...r.e.raw, _score: r.score, _type: r.e.type })), null, 2));
    return;
  }
  if (results.length === 0) {
    console.log("没有命中。换个关键词，或去掉过滤条件再试。");
    return;
  }
  console.log(results.map((r) => formatEntry(r.e, r.score)).join("\n\n"));
  console.log(`\n共 ${results.length} 条${queryRaw ? `（关键词：${queryRaw}）` : ""}。`);
}

main();
