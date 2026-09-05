export function cn(...inputs: Array<string | false | null | undefined | 0>): string {
  return inputs.filter(Boolean).join(" ");
}
