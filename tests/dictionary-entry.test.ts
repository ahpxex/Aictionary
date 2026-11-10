import { describe, expect, test } from "bun:test";
import {
  buildGlance,
  glanceForSections,
  headwordTerms,
  highlightTerms,
  organizeSections,
  sectionRelations,
} from "../src/shared/lib/dictionary-entry";
import type {
  DictionaryEntry,
  DictionaryMeaning,
  DictionaryPosGroup,
  MeaningPriority,
} from "../src/shared/types/dictionary";

let senseCounter = 0;

function meaning(gloss: string, priority: MeaningPriority): DictionaryMeaning {
  senseCounter += 1;
  return {
    sense_id: `s${senseCounter}`,
    priority,
    short_gloss: gloss,
    learner_explanation: `${gloss}的解释`,
    usage_note: null,
    labels: [],
    topics: [],
    examples: [],
  };
}

function group(
  pos: string,
  meanings: DictionaryMeaning[],
  extra: Partial<DictionaryPosGroup> = {}
): DictionaryPosGroup {
  return {
    pos,
    etymology_id: null,
    proper_name: false,
    summary: `${pos} summary`,
    usage_note: null,
    forms: [],
    pronunciations: [],
    relations: [],
    meanings,
    ...extra,
  };
}

function entry(groups: DictionaryPosGroup[]): DictionaryEntry {
  return {
    schema_version: "distribution_entry_v5",
    entry_id: "e",
    headword: "bank",
    normalized_headword: "bank",
    headword_language: { code: "en", name: "English" },
    definition_language: { code: "zh", name: "Chinese" },
    entry_type: "standard",
    headword_summary: "",
    memory_hook: "",
    study_notes: [],
    etymology_note: null,
    etymologies: [],
    pos_groups: groups,
  };
}

// "bank" as the distribution orders it: alphabetical, proper names first.
const bank = entry([
  group("name", [meaning("村名", "rare")], { proper_name: true }),
  group("name", [meaning("姓氏", "common")], { proper_name: true }),
  group("noun", [meaning("银行", "core"), meaning("庄家", "common")]),
  group("noun", [meaning("河岸", "core"), meaning("浅滩", "rare")]),
  group("noun", [meaning("法官席", "rare")]),
  group("verb", [meaning("存钱", "core"), meaning("提供银行服务", "common")]),
  group("verb", [meaning("排成一行", "rare")]),
]);

describe("organizeSections", () => {
  test("merges groups by part of speech and puts the useful ones first", () => {
    const sections = organizeSections(bank);
    expect(sections.map((section) => section.key)).toEqual([
      "noun",
      "verb",
      "name-name",
    ]);
    expect(sections[0].groups.map(({ index }) => index)).toEqual([2, 3, 4]);
    expect(sections[2].properName).toBe(true);
  });

  test("groups holding a core sense lead their section", () => {
    const sections = organizeSections(
      entry([
        group("verb", [meaning("旧式用法", "rare")]),
        group("verb", [meaning("常见用法", "common")]),
        group("verb", [meaning("核心用法", "core")]),
      ])
    );
    expect(sections[0].groups.map(({ index }) => index)).toEqual([2, 1, 0]);
  });

  test("more core senses outrank a longer list of common ones", () => {
    const sections = organizeSections(
      entry([
        group("adj", [meaning("a", "common"), meaning("b", "common"), meaning("c", "common")]),
        group("noun", [meaning("d", "core"), meaning("e", "core")]),
      ])
    );
    expect(sections.map((section) => section.key)).toEqual(["noun", "adj"]);
  });

  test("ties keep the distribution's order", () => {
    const sections = organizeSections(
      entry([group("adv", [meaning("a", "common")]), group("adj", [meaning("b", "common")])])
    );
    expect(sections.map((section) => section.key)).toEqual(["adv", "adj"]);
  });

  test("a common noun marked as a proper name is kept apart from the plain one", () => {
    const sections = organizeSections(
      entry([
        group("noun", [meaning("光", "core")]),
        group("noun", [meaning("敬称", "rare")], { proper_name: true }),
      ])
    );
    expect(sections.map((section) => section.key)).toEqual(["noun", "noun-name"]);
  });
});

describe("glance", () => {
  test("lists core senses across groups first, then common ones, never rare ones", () => {
    expect(glanceForSections(organizeSections(bank))).toEqual([
      { key: "noun", pos: "noun", glosses: ["银行", "河岸", "庄家"] },
      { key: "verb", pos: "verb", glosses: ["存钱", "提供银行服务"] },
      { key: "name-name", pos: "name", glosses: ["姓氏"] },
    ]);
  });

  test("a section of only rare senses still lists them", () => {
    const rows = glanceForSections(
      organizeSections(
        entry([
          group("noun", [meaning("光", "core")]),
          group("verb", [meaning("卸货", "rare"), meaning("离开", "rare")]),
        ])
      )
    );
    expect(rows[1]).toEqual({ key: "verb", pos: "verb", glosses: ["卸货", "离开"] });
  });

  test("caps each line, drops blanks and duplicates", () => {
    expect(
      buildGlance([
        { key: "n", pos: "noun", glosses: ["一", " ", null, "一", "二", "三", "四", "五"] },
      ])
    ).toEqual([{ key: "n", pos: "noun", glosses: ["一", "二", "三", "四"] }]);
  });

  test("is omitted when it would only repeat a single sense", () => {
    expect(buildGlance([{ key: "n", pos: "noun", glosses: ["银行"] }])).toEqual([]);
    expect(buildGlance([{ key: "n", pos: undefined, glosses: ["银行", "河岸"] }])).toEqual([]);
  });
});

describe("sectionRelations", () => {
  test("merges and dedupes relations across a section's groups", () => {
    const [section] = organizeSections(
      entry([
        group("noun", [meaning("a", "core")], {
          relations: [
            { type: "synonym", word: "shore", lang_code: "en" },
            { type: "synonym", word: "coast", lang_code: "en" },
          ],
        }),
        group("noun", [meaning("b", "common")], {
          relations: [
            { type: "synonym", word: "shore", lang_code: "en" },
            { type: "antonym", word: "sea", lang_code: "en" },
          ],
        }),
      ])
    );
    expect([...sectionRelations(section)]).toEqual([
      ["synonym", ["shore", "coast"]],
      ["antonym", ["sea"]],
    ]);
  });
});

const marked = (text: string, terms: string[]) =>
  highlightTerms(text, terms)
    .filter((segment) => segment.match)
    .map((segment) => segment.text);

describe("highlightTerms", () => {
  test("marks the headword and its regular inflections as whole words", () => {
    expect(marked("Light lights the lighting, not the delight.", ["light"])).toEqual([
      "Light",
      "lights",
      "lighting",
    ]);
  });

  test("handles the usual spelling changes", () => {
    expect(marked("She was making tea.", ["make"])).toEqual(["making"]);
    expect(marked("He studied and studies.", ["study"])).toEqual(["studied", "studies"]);
    expect(marked("It stopped, then kept stopping.", ["stop"])).toEqual([
      "stopped",
      "stopping",
    ]);
  });

  test("irregular forms come from the term list", () => {
    expect(marked("She lit a candle.", ["light", "lit"])).toEqual(["lit"]);
  });

  test("multi-word headwords match across any whitespace", () => {
    expect(marked("The plane took  off on time.", ["take off", "took off"])).toEqual([
      "took  off",
    ]);
  });

  test("segments always reassemble the original text", () => {
    const text = "Lights, light, and lighter lights!";
    const joined = highlightTerms(text, ["light", "lighter"])
      .map((segment) => segment.text)
      .join("");
    expect(joined).toBe(text);
  });

  test("regex characters in terms are treated literally", () => {
    expect(marked("C++ is not C.", ["C++"])).toEqual(["C++"]);
    expect(highlightTerms("anything", ["a"])).toEqual([{ text: "anything", match: false }]);
  });
});

describe("headwordTerms", () => {
  test("uses the headword and its listed forms, skipping table bookkeeping", () => {
    expect(
      headwordTerms(
        "light",
        group("verb", [], {
          forms: [
            { text: "lit", tags: ["past"], roman: null },
            { text: "en-verb", tags: ["inflection-template"], roman: null },
            { text: "—", tags: [], roman: null },
          ],
        })
      )
    ).toEqual(["light", "lit"]);
  });
});
