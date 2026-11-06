# 人物数据库 Schema（v1.0.0）

## 这是什么

一套给 AI 人设角色用的 canon 数据库 schema：**结构化、可查询的原著底子**。
skill 是行为规矩（她怎么说话、按什么阶段走、什么绝不能做），数据库是 canon 证据
（她是谁、说过什么、做过什么、按什么顺序变的）。两者互补，数据库不替代 skill。

## 设计原则

1. **意译、浓缩，绝不照抄原文。** 所有 `text` 字段都是对原著台词/内心的
   凝缩意译，标 `paraphrase: true`。任何条目都不许写成她的原话，也不许
   当作 verbatim 引用。
2. **小说剧情 ≠ 与 skill 使用者的共同经历。** `key_events` 只当背景参考，
   绝不能写成她和某个 skill 使用者之间发生过的事。skill 的铁律
   （剧情不进对话）照样管着这个库。
3. **诚实标注缺口。** 没读过、没核实、版本不一致的东西进 `flags`，
   不许编一个填上。
4. **一个角色一个目录，同一套表。** 目录名即角色 id
   （`xia-ningqi/`、`lin-chuxue/`、`musheng/`…），集合与字段完全一致，
   换角色只换数据，不换结构。

## 目录结构

```
character-db/
  <character-id>/            # 角色 id，如 xia-ningqi
    schema.md                # 本文件（各角色目录里放一份副本，或只放一份在根目录）
    index.json               # 清单：集合、条目数、版本
    profile.json             # 档案（单对象）
    traits.json              # 性格特点
    relationships.json       # 人际关系
    speech_rules.json        # 说话规则
    growth_arc.json          # 成长弧线
    lines.json               # 代表性台词（意译）
    inner_monologues.json    # 内心独白（意译，标 INNER）
    key_events.json          # 关键事件（背景参考）
    flags.json               # 缺口与未核实项
    query.mjs                # 查询工具（Node 标准库 only，不联网）
    README.md                # 本库说明
```

## 文件信封

每个集合文件都是一个 JSON 对象：

| 字段 | 类型 | 说明 |
|---|---|---|
| `character` | string | 角色 id，如 `xia-ningqi` |
| `character_name` | string | 角色名，如 `夏柠柒` |
| `collection` | string | 集合名，如 `lines` |
| `schema_version` | string | schema 版本，当前 `1.0.0` |
| `updated` | string | 最后更新日期 `YYYY-MM-DD` |
| `paraphrase_only` | boolean | 是否全库意译（本库恒为 `true`） |
| `entries` | array | 条目数组（`profile.json` 例外，见下） |

`profile.json` 不用 `entries` 数组，只有一个 `profile` 对象（档案只有一份）。

## 条目通用字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | 是 | 全库唯一，如 `line-107-01`、`trait-04`、`event-187-194` |
| `type` | string | 是 | 集合名，与文件名对应 |
| `chapter` | number \| null | 否 | 单章号；无单章时为 `null` |
| `chapter_label` | string \| null | 否 | 重号/特殊章号，如 `151a`（聚餐2）、`151b`（晚安）、`194a`、《一人一巴掌》、`194b`（《竞争者》） |
| `chapter_range` | [number, number] \| null | 否 | 章节范围，如 `[131, 165]`（弧线、事件跨章时用） |
| `stage` | string \| null | 否 | 见下“阶段” |
| `addressee` | string \| null | 否 | 说话对象，见下“对象” |
| `emotion` | string[] | 否 | 情绪标签，见下“情绪词表” |
| `tags` | string[] | 否 | 自由检索词，如 `["吃醋","定位器"]` |
| `text` | string | 是 | 正文（意译文本 / 规则描述 / 事件描述） |
| `scene` | string \| null | 否 | 场景一句话（lines / inner 用） |
| `source` | string | 是 | 料源，如 `pass1-summary`、`pass5c2-summary`、`v2.4-portrayal`、`corpus-ch001-060` |
| `paraphrase` | boolean | 是 | 恒为 `true`（lines / inner 必须有；其余集合为规则与描述性文字，同样不抄原文） |

## 阶段（stage）

按 skill 的阶段模型，不按初版语料的旧分段：

| 值 | 含义 | 章节参考 |
|---|---|---|
| `early` | 早期：冷、倔、不信任 | 开局到相认前（约 1–60 章） |
| `mid` | 中期：暧昧、奖励、嫉妒制度化 | 相认后到确立关系前（61–165 章） |
| `late` | 后期：清醒型占有 + 照顾型控制 | 确立关系后到婚礼（166–312 章） |

注意：初版语料（ch001-060.md 等）里的 early/mid 分段与此不一致
（它把 45–60 章标为 mid），入库时一律按上表归一，不沿用旧标。

## 对象（addressee）

`祁南`、`叶安苒`、`阿嫲`、`苏晴`、`母亲`、`生父`、`兄长`、`孟诗语`、
`叶凡`、`李昭年`、`阮鸳`、`姜琴`、`心理医生`、`陌生人`、`搭讪者`、
`王涛`、`王庆`、`林小小`、`玲雅`、`王清`、`宋瑶`、`俪娜`、`秦时雨`、
`陆宴`、`姜皖`、`宋晶`、`其他`、`自身`（内心独白无明确对象时用）。

别名归一（镜像用字不一致，视为同一人，见 flags）：
`叶安冉` → `叶安苒`；`孟诗雨` → `孟诗语`；`李兆年` → `李昭年`；
`姜萍` → `姜琴`；`彦姗` → `俪娜`；`夏凝柒` / `夏宁柒` 是镜像错字，不是人名。

## 情绪词表（emotion）

受控词表，新增情绪先加进这里再用：

`冷拒`、`质问`、`毒舌`、`撒娇`、`吃醋`、`威胁`、`示弱`、`自嘲`、
`关心`、`宣示`、`害羞`、`愤怒`、`悲伤`、`俏皮`、`坦白`、`命令`、
`调侃`、`哭腔`、`醉话`、`护短`、`盘问`、`唠叨`、`逞强`、`温柔`、
`恐惧`、`绝望`、`动摇`、`坚定`、`玩笑`、`疑惑`、`失落`、`安心`、
`自省`、`失控`、`克制`、`委屈`、`不安`。

## 各集合专用字段

### profile（单对象）

| 字段 | 说明 |
|---|---|
| `name` / `birth_name` | 现用名 / 出生名 |
| `novel` / `author` / `fanqie_id` / `word_count` / `ending` | 出处 |
| `birthday` | 固定生日，如 `5月5日` |
| `height` / `build` / `birthmark` / `clothing` | 外貌锚点 |
| `items` | 随身物：`{harmonica, diary, cat, ...}`，各带一句话说明 |
| `health` | 身体状况 |
| `family` | `{father, mother, brother, foster_mother, ...}`，各带身份与一句话 |
| `background` | 身世一句话 |
| `livelihood` | 谋生方式 |
| `friends` / `rivals` | 朋友 / 对手与施害者（名字即可，详情在 relationships） |
| `final_state` | 结尾状态一句话 |

### traits

| 字段 | 说明 |
|---|---|
| `trait` | 特点名，如 `刺猬式自保` |
| `evidence_chapters` | number[]，证据章节 |
| `evidence_note` | 证据一句话 |

### relationships

| 字段 | 说明 |
|---|---|
| `person` | 对方名字（用归一后的名字） |
| `relation` | 关系，如 `对手方 / 穿书后男主位置`、`养母`、`闺蜜` |
| `speech_pattern` | 她对这个人说话的方式，一句话 |
| `dynamics` | 关系动态，一到两句 |
| `evidence_chapters` | number[] |

### speech_rules

| 字段 | 说明 |
|---|---|
| `rule` | 规则名，如 `吃醋链` |
| `applies_to` | 适用场合，如 `对抗性回复`、`嫉妒表达`、`嘴硬收尾` |
| `stage_scope` | `early` / `mid` / `late` / `all` |
| `evidence_chapters` | number[] |

### growth_arc

| 字段 | 说明 |
|---|---|
| `range_label` | 如 `131–165` |
| `title` | 如 `病娇明牌·丧亲与宣示主权` |
| `anchors` | number[]，锚点章节 |
| `summary` | 本段弧线描述 |

### lines / inner_monologues

`inner_monologues` 的条目与 `lines` 同构，另加 `"inner": true`，
表示这是内心独白（日记、心声、内心描写），不是说出口的话。

### key_events

| 字段 | 说明 |
|---|---|
| `event` | 事件名，如 `摩天轮初吻` |
| `significance` | 意义一句话 |
| `canon_only` | 恒为 `true`：纯小说背景，绝不是与 skill 使用者的共同经历 |

### flags

| 字段 | 说明 |
|---|---|
| `flag_type` | `missing`（永久缺失）/ `unresolved`（未解决）/ `unverified`（未核实）/ `variant`（版本用字差异）/ `coverage`（覆盖缺口） |
| `status` | 当前状态一句话 |
| `chapter` / `chapter_range` | 涉及章节（没有时为 `null`） |

## 查询工具

`query.mjs`（Node 标准库 only，不联网）：

```
node query.mjs <关键词> [--type lines|inner|events|traits|...]
                        [--chapter 107 | --chapter 131-165 | --chapter 151a]
                        [--addressee 祁南] [--emotion 吃醋] [--stage mid|late]
                        [--limit N] [--json]
node query.mjs --stats            # 各集合条目数
node query.mjs --type lines       # 无关键词时按过滤条件列出
```

分词：中文按重叠 bigram + 短词整词 + 单字（高频虚字不作单字索引），
与记忆插件的 tokenize 思路同源、为本库重写。排序：关键词命中权重
（`tags` > `text` > `scene`）+ 短语整词加分，按分数降序、同分按章节升序。

## 版本

- `1.0.0`（2026-11-06）：夏柠柒首版。
  - 2026-11-06 pass5d 补读：对象词表加 玲雅、王清；情绪词表加 委屈、不安；211–230 章逐句补读入库（仍为 1.0.0，未改结构）。料源为浓缩版 pass 总结
  （pass1–pass5a、pass5b1/5b2、pass5c1/5c2/5c3）+ v2.4 刻画块
  + 初版语料场景索引。初版语料缺口大，以浓缩版总结为准。
  - 2026-11-06 pass5e 补读：对象词表加 宋瑶；别名归一加 姜萍 → 姜琴；231–264 章逐句补读入库，211–230 章五处回查结论折进 flag-17 与相关条目（仍为 1.0.0，未改结构）。
  - 2026-11-06 pass5f 补读：对象词表加 俪娜、秦时雨、陆宴、姜皖、宋晶；别名归一加 彦姗 → 俪娜；265–312 章逐句补读入库，两处定论（173→273、174→274；母亲名字三种写法并存）折进 flag-11、flag-02（仍为 1.0.0，未改结构）。
