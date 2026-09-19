export type Layer = "unit" | "e2e" | "pixel";
export type Gate = "block" | "optional";

export type Step = {
  op: string;
  [key: string]: unknown;
};

export type Expectation = {
  assert: string;
  [key: string]: unknown;
};

/** One Scrutiny / feature case. JSON under tests/cases/ is the source of truth. */
export type CaseFile = {
  id: string;
  layer: Layer;
  title: string;
  steps: Step[];
  expect: Expectation[];
  gate: Gate;
  /** e2e cases default to the Pixel project; set desktop for the 1280×800 smoke. */
  viewport?: "pixel" | "desktop";
};

export const REQUIRED_CASE_IDS = [
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",
  "B7",
  "B8",
  "B9",
  "B10",
  "B11",
  "C14",
  "C15",
  "C16",
] as const;

export const BLOCK_CASE_IDS = ["B7", "B8", "B9", "B10", "C14", "C15", "C16"] as const;
