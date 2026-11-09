import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISPLAY_LIMIT,
  ratingOf,
  relativeTime,
  selectForDisplay,
  toCardReview,
} from "../present.ts";
import { POPULATED_FIXTURE } from "../fixtures.ts";
import type { GoogleReview } from "../types.ts";

const NOW = new Date("2026-11-09T12:00:00Z");

test("selectForDisplay: newest updateTime first, six at most, unspecified rating dropped", () => {
  const picked = selectForDisplay(POPULATED_FIXTURE);
  assert.equal(picked.length, DISPLAY_LIMIT);
  const times = picked.map((r) => Date.parse(r.updateTime));
  for (let i = 1; i < times.length; i++)
    assert.ok(times[i - 1] >= times[i], "sorted by updateTime desc");
  const ids = picked.map((r) => r.reviewId);
  assert.ok(!ids.includes("fixture-08"), "STAR_RATING_UNSPECIFIED is skipped");
  assert.ok(
    !ids.includes("fixture-07"),
    "the oldest of the remaining seven falls outside the six",
  );
  assert.equal(
    ids[0],
    "fixture-04",
    "an edited old review sorts by its update time, not its creation time",
  );
  assert.ok(
    ids.includes("fixture-06"),
    "two-star review kept: no rating filter",
  );
});

test("selectForDisplay does not mutate its input", () => {
  const copy = POPULATED_FIXTURE.map((r) => r.reviewId);
  selectForDisplay(POPULATED_FIXTURE);
  assert.deepEqual(
    POPULATED_FIXTURE.map((r) => r.reviewId),
    copy,
  );
});

test("toCardReview preserves text verbatim, including translation disclosures", () => {
  const translated = POPULATED_FIXTURE.find(
    (r) => r.reviewId === "fixture-05",
  )!;
  const card = toCardReview(translated, NOW)!;
  assert.equal(card.text, translated.comment);
  assert.ok(card.text!.startsWith("(Translated by Google)"));
  assert.ok(card.text!.includes("(Original)"));
});

test("toCardReview: rating-only review has text === null and keeps its rating", () => {
  const ratingOnly = POPULATED_FIXTURE.find(
    (r) => r.reviewId === "fixture-03",
  )!;
  const card = toCardReview(ratingOnly, NOW)!;
  assert.equal(card.text, null);
  assert.equal(card.rating, 3);
});

test("toCardReview: anonymous reviewer → 'Google user', no avatar; missing photo → no avatar", () => {
  const anon = toCardReview(
    POPULATED_FIXTURE.find((r) => r.reviewId === "fixture-02")!,
    NOW,
  )!;
  assert.equal(anon.name, "Google user");
  assert.equal(anon.avatarUrl, null);
  const noPhoto = toCardReview(
    POPULATED_FIXTURE.find((r) => r.reviewId === "fixture-01")!,
    NOW,
  )!;
  assert.equal(noPhoto.name, "Fixture Reviewer One");
  assert.equal(noPhoto.avatarUrl, null);
  const withPhoto = toCardReview(
    POPULATED_FIXTURE.find((r) => r.reviewId === "fixture-04")!,
    NOW,
  )!;
  assert.ok(withPhoto.avatarUrl);
});

test("toCardReview: date label is based on updateTime and says 'Updated'", () => {
  const edited = POPULATED_FIXTURE.find((r) => r.reviewId === "fixture-04")!;
  const card = toCardReview(edited, NOW)!;
  assert.equal(card.updatedAt, edited.updateTime);
  assert.equal(card.updatedLabel, "Updated 2 days ago");
});

test("toCardReview returns null for an unspecified rating", () => {
  const r: GoogleReview = {
    ...POPULATED_FIXTURE[0],
    starRating: "STAR_RATING_UNSPECIFIED",
  };
  assert.equal(ratingOf(r), null);
  assert.equal(toCardReview(r, NOW), null);
});

test("relativeTime buckets", () => {
  const d = (days: number) =>
    new Date(NOW.getTime() - days * 86_400_000).toISOString();
  assert.equal(relativeTime(d(0), NOW), "today");
  assert.equal(relativeTime(d(1), NOW), "yesterday");
  assert.equal(relativeTime(d(6), NOW), "6 days ago");
  assert.equal(relativeTime(d(7), NOW), "1 week ago");
  assert.equal(relativeTime(d(20), NOW), "2 weeks ago");
  assert.equal(relativeTime(d(45), NOW), "1 month ago");
  assert.equal(relativeTime(d(400), NOW), "1 year ago");
  assert.equal(relativeTime("garbage", NOW), "");
});
