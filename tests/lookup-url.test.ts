import { describe, expect, test } from "bun:test";
import {
  MAX_LOOKUP_URL_WORD_LENGTH,
  parseLookupUrl,
} from "../src/shared/lib/lookup-url";

describe("aictionary:// lookup links", () => {
  test("the documented form opens the word", () => {
    expect(parseLookupUrl("aictionary://lookup?word=serendipity")).toEqual({
      kind: "lookup",
      word: "serendipity",
    });
  });

  test("percent-encoding and form-encoded spaces decode to the phrase", () => {
    expect(parseLookupUrl("aictionary://lookup?word=take%20off")).toEqual({
      kind: "lookup",
      word: "take off",
    });
    expect(parseLookupUrl("aictionary://lookup?word=take+off")).toEqual({
      kind: "lookup",
      word: "take off",
    });
    expect(
      parseLookupUrl(`aictionary://lookup?word=${encodeURIComponent("café")}`)
    ).toEqual({ kind: "lookup", word: "café" });
  });

  test("Chinese text passes through for the reverse lookup", () => {
    expect(
      parseLookupUrl(`aictionary://lookup?word=${encodeURIComponent("意外")}`)
    ).toEqual({ kind: "lookup", word: "意外" });
  });

  test("spelling variants other apps produce are accepted", () => {
    for (const url of [
      "aictionary:lookup?word=apple",
      "aictionary://lookup/?word=apple",
      "AICTIONARY://LOOKUP?word=apple",
      "aictionary://Lookup?word=apple&source=shortcuts",
      "  aictionary://lookup?word=apple  ",
    ]) {
      expect(parseLookupUrl(url)).toEqual({ kind: "lookup", word: "apple" });
    }
  });

  test("the word keeps its own case and loses stray whitespace", () => {
    expect(
      parseLookupUrl("aictionary://lookup?word=%20%20New%0A%09York%20")
    ).toEqual({ kind: "lookup", word: "New York" });
  });

  test("the first word wins when the parameter repeats", () => {
    expect(parseLookupUrl("aictionary://lookup?word=one&word=two")).toEqual({
      kind: "lookup",
      word: "one",
    });
  });

  test("a lookup without a usable word is rejected", () => {
    for (const url of [
      "aictionary://lookup",
      "aictionary://lookup?word=",
      "aictionary://lookup?word=%20%0A",
      "aictionary://lookup?q=apple",
    ]) {
      expect(parseLookupUrl(url)).toEqual({
        kind: "invalid",
        reason: "missing_word",
      });
    }
  });

  test("other actions and extra path segments are not guessed at", () => {
    for (const url of [
      "aictionary://search?word=apple",
      "aictionary://lookup/apple",
      "aictionary://?word=apple",
      "aictionary:?word=apple",
    ]) {
      expect(parseLookupUrl(url)).toEqual({
        kind: "invalid",
        reason: "unknown_action",
      });
    }
  });

  test("queries past the length bound are rejected, counted in characters", () => {
    const atLimit = "字".repeat(MAX_LOOKUP_URL_WORD_LENGTH);
    expect(
      parseLookupUrl(`aictionary://lookup?word=${encodeURIComponent(atLimit)}`)
    ).toEqual({ kind: "lookup", word: atLimit });

    const emoji = "😀".repeat(MAX_LOOKUP_URL_WORD_LENGTH);
    expect(
      parseLookupUrl(`aictionary://lookup?word=${encodeURIComponent(emoji)}`)
    ).toEqual({ kind: "lookup", word: emoji });

    expect(
      parseLookupUrl(
        `aictionary://lookup?word=${"a".repeat(MAX_LOOKUP_URL_WORD_LENGTH + 1)}`
      )
    ).toEqual({ kind: "invalid", reason: "word_too_long" });
  });

  test("links for other schemes are left alone", () => {
    for (const url of [
      "https://example.com/lookup?word=apple",
      "mailto:someone@example.com",
      "aictionaryx://lookup?word=apple",
      "not a url",
    ]) {
      expect(parseLookupUrl(url)).toEqual({ kind: "foreign" });
    }
  });
});
