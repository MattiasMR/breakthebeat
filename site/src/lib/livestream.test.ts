import { describe, expect, it } from "vitest";
import { isYouTubeVideoId, parseYouTubeVideoId } from "./livestream";

describe("YouTube livestream links", () => {
  it.each([
    "M7lc1UVf-VE", " https://www.youtube.com/watch?v=M7lc1UVf-VE&feature=share ",
    "https://youtu.be/M7lc1UVf-VE?si=shared", "https://www.youtube.com/live/M7lc1UVf-VE",
    "https://m.youtube.com/watch?v=M7lc1UVf-VE", "https://youtube.com/embed/M7lc1UVf-VE",
    "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE", "https://youtube.com/shorts/M7lc1UVf-VE"
  ])("normalizes a supported video link: %s", (input) => {
    expect(parseYouTubeVideoId(input)).toBe("M7lc1UVf-VE");
  });
  it.each([
    "", "https://youtube.com/@breakthebeat/live", "https://youtube.com/playlist?list=test",
    "https://youtube.com/watch?v=short", "https://youtu.be/M7lc1UVf-VE/more",
    "https://youtube.com.evil.test/watch?v=M7lc1UVf-VE", "https://evil.test/M7lc1UVf-VE",
    "https://youtube.com@evil.test/watch?v=M7lc1UVf-VE", "http://youtube.com/watch?v=M7lc1UVf-VE",
    "javascript:alert(1)", '<iframe src="https://youtube.com/embed/M7lc1UVf-VE"></iframe>',
    "https://user:secret@youtube.com/watch?v=M7lc1UVf-VE", "https://youtube.com:444/watch?v=M7lc1UVf-VE"
  ])("rejects unsupported or unsafe input: %s", (input) => {
    expect(parseYouTubeVideoId(input)).toBeNull();
  });
  it("rejects invalid values from the public API", () => {
    for (const value of [undefined, null, 12345678901, "<script>bad!", "M7lc1UVf-VE\n"]) {
      expect(isYouTubeVideoId(value)).toBe(false);
    }
  });
});
