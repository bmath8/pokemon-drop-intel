import { describe, expect, it } from "vitest";

import { parseEmailAlert, parseMailboxArchive, parseRawEmail } from "./email-parser";

describe("parseEmailAlert", () => {
  it("classifies a Pokemon Center early-access invite as critical with full extraction", () => {
    const result = parseEmailAlert(
      "Your Pokemon Center early access invite",
      "<p>Use this single-use invite link: https://www.pokemoncenter.com/invite/abc123 before March 5, 2026.</p>" +
        "<p>Limit one per customer.</p>",
    );

    expect(result.channel).toBe("Pokemon Center");
    expect(result.signalType).toBe("Early Access Invite");
    expect(result.urgency).toBe("Critical");
    expect(result.confidence).toBe("High");
    expect(result.dates).toEqual(["March 5, 2026"]);
    expect(result.urls).toEqual(["https://www.pokemoncenter.com/invite/abc123"]);
    expect(result.purchaseLimit).toBe("Limit one per customer");
    expect(result.summary).toBe("Pokemon Center early access invite mentions March 5, 2026.");
    expect(result.matchedKeywords).toEqual(
      expect.arrayContaining(["pokemon center", "early access", "single-use", "invite link"]),
    );
    // two invite-specific steps + the critical-alert journal reminder
    expect(result.actionItems).toHaveLength(3);
  });

  it("rates a Target preorder as high urgency and adds the pickup-radius action", () => {
    const result = parseEmailAlert(
      "Preorder now open at Target",
      "Reserve now. Limited to two per household.",
    );

    expect(result.channel).toBe("Target");
    expect(result.signalType).toBe("Preorder Open");
    expect(result.urgency).toBe("High");
    expect(result.purchaseLimit).toBe("Limited to two per household");
    expect(result.actionItems.some((item) => item.includes("pickup radius"))).toBe(true);
  });

  it("treats a Walmart restock as medium urgency", () => {
    const result = parseEmailAlert("Walmart update", "Your item is back in stock at Walmart.");

    expect(result.channel).toBe("Walmart");
    expect(result.signalType).toBe("Restock Alert");
    expect(result.urgency).toBe("Medium");
    expect(result.confidence).toBe("High");
  });

  it("escalates to high urgency on expiry wording even without a known signal type", () => {
    const result = parseEmailAlert("Target offer", "Your coupon expires soon.");

    expect(result.channel).toBe("Target");
    expect(result.signalType).toBe("General Alert");
    expect(result.urgency).toBe("High");
    expect(result.confidence).toBe("Medium");
  });

  it("falls back to a low-confidence general alert for unrelated mail", () => {
    const result = parseEmailAlert("Hello", "Just saying hi");

    expect(result).toMatchObject({
      channel: "Unknown",
      signalType: "General Alert",
      urgency: "Low",
      confidence: "Low",
      summary: "Unclassified sender general alert.",
      purchaseLimit: null,
      dates: [],
      urls: [],
    });
    expect(result.actionItems).toHaveLength(1);
  });

  it("ignores keywords hidden inside <script> and <style> blocks", () => {
    const result = parseEmailAlert(
      "Newsletter",
      "<style>.target{color:red}</style><script>track('walmart')</script><p>Monthly news</p>",
    );

    expect(result.channel).toBe("Unknown");
  });

  it("de-duplicates repeated URLs and dates", () => {
    const result = parseEmailAlert(
      "Queue update",
      "Join https://example.com/q on April 1, 2026. Again: https://example.com/q April 1, 2026.",
    );

    expect(result.urls).toEqual(["https://example.com/q"]);
    expect(result.dates).toEqual(["April 1, 2026"]);
  });
});

describe("parseRawEmail", () => {
  it("reads From/Subject and keeps folded (multi-line) headers whole", () => {
    const raw = [
      "From: Pokemon Center <news@pokemoncenter.com>",
      "Subject: Early access",
      " is here",
      "Content-Type: text/plain",
      "",
      "Hello trainer",
    ].join("\r\n");

    const result = parseRawEmail(raw);

    expect(result.from).toBe("Pokemon Center <news@pokemoncenter.com>");
    expect(result.subject).toBe("Early access is here");
    expect(result.body).toBe("Hello trainer");
  });

  it("decodes quoted-printable bodies including soft line breaks", () => {
    const raw = [
      "Subject: Price",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Price is =2459.99 to=",
      "day",
    ].join("\r\n");

    expect(parseRawEmail(raw).body).toBe("Price is $59.99 today");
  });

  it("returns an empty body and null sender when there is no header/body separator", () => {
    const result = parseRawEmail("Subject: Only headers");

    expect(result.subject).toBe("Only headers");
    expect(result.from).toBeNull();
    expect(result.body).toBe("");
  });

  it("picks the text/plain part of a multipart email, skipping preamble and part headers", () => {
    const raw = [
      "Subject: Restock",
      'Content-Type: multipart/alternative; boundary="b1"',
      "",
      "This is a multi-part message in MIME format.",
      "--b1",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<p>HTML version</p>",
      "--b1",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Back in stock =E2=80=94 now",
      "--b1--",
    ].join("\r\n");

    const body = parseRawEmail(raw).body;
    expect(body).toBe("Back in stock — now"); // =E2=80=94 is a UTF-8 em dash
    expect(body).not.toContain("HTML version");
    expect(body).not.toContain("multi-part message");
    expect(body).not.toContain("Content-Type");
  });

  it("decodes a base64 text part", () => {
    const encoded = btoa("Preorder is live");
    const raw = [
      "Subject: Base64",
      "Content-Type: multipart/mixed; boundary=XYZ",
      "",
      "--XYZ",
      "Content-Type: text/plain",
      "Content-Transfer-Encoding: base64",
      "",
      encoded,
      "--XYZ--",
    ].join("\n");

    expect(parseRawEmail(raw).body).toBe("Preorder is live");
  });
});

describe("parseMailboxArchive", () => {
  it("splits an mbox archive on envelope lines and numbers the messages", () => {
    const mbox = [
      "From sender@example.com Mon Jan  1 00:00:00 2026",
      "Subject: First",
      "",
      "Body one",
      "From sender@example.com Mon Jan  2 00:00:00 2026",
      "Subject: Second",
      "",
      "Body two",
    ].join("\n");

    const messages = parseMailboxArchive(mbox);

    expect(messages.map((message) => [message.index, message.subject, message.body])).toEqual([
      [1, "First", "Body one"],
      [2, "Second", "Body two"],
    ]);
  });

  it("drops messages with neither subject nor body", () => {
    expect(parseMailboxArchive("")).toEqual([]);
  });
});
