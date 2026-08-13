import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_HOSTED_UPLOAD_MB,
  DEFAULT_LOCAL_UPLOAD_MB,
  resolveUploadConfig,
} from "../lib/postlint/config/upload";
import { resolveMediaBinary } from "../lib/postlint/media/binaries";

describe("upload configuration", () => {
  it("keeps the larger local development allowance", () => {
    const config = resolveUploadConfig({});
    assert.equal(config.mode, "local");
    assert.equal(config.maxUploadMb, DEFAULT_LOCAL_UPLOAD_MB);
    assert.equal(config.maxUploadBytes, 250 * 1024 * 1024);
    assert.match(config.label, /Local analysis/);
  });

  it("uses the deliberately small hosted demo allowance", () => {
    const config = resolveUploadConfig({ POSTLINT_HOSTED_DEMO: "true" });
    assert.equal(config.mode, "hosted");
    assert.equal(config.maxUploadMb, DEFAULT_HOSTED_UPLOAD_MB);
    assert.equal(config.maxUploadBytes, 4 * 1024 * 1024);
    assert.equal(config.label, "Hackathon demo: videos up to 4 MB");
  });

  it("recognizes a Vercel hosted environment and permits an explicit override", () => {
    assert.equal(resolveUploadConfig({ VERCEL: "1" }).maxUploadMb, 4);

    const overridden = resolveUploadConfig({
      VERCEL: "1",
      POSTLINT_MAX_UPLOAD_MB: "3.5",
    });
    assert.equal(overridden.mode, "custom");
    assert.equal(overridden.maxUploadBytes, Math.floor(3.5 * 1024 * 1024));
  });

  it("ignores invalid explicit limits", () => {
    assert.equal(
      resolveUploadConfig({ POSTLINT_MAX_UPLOAD_MB: "not-a-number" })
        .maxUploadMb,
      DEFAULT_LOCAL_UPLOAD_MB,
    );
  });
});

describe("media binary resolution", () => {
  it("prefers an explicitly configured path", () => {
    assert.deepEqual(
      resolveMediaBinary("ffmpeg", {
        environment: { FFMPEG_PATH: "/opt/media tools/ffmpeg" },
        packagedPaths: { ffmpeg: "/package/ffmpeg" },
      }),
      { path: "/opt/media tools/ffmpeg", source: "configured" },
    );
  });

  it("uses a packaged binary when no explicit path exists", () => {
    assert.deepEqual(
      resolveMediaBinary("ffprobe", {
        environment: {},
        packagedPaths: { ffprobe: "/package/ffprobe" },
      }),
      { path: "/package/ffprobe", source: "packaged" },
    );
  });

  it("falls back to a PATH command when no packaged binary is available", () => {
    assert.deepEqual(
      resolveMediaBinary("ffmpeg", {
        environment: {},
        packagedPaths: { ffmpeg: null },
      }),
      { path: "ffmpeg", source: "system" },
    );
  });
});

