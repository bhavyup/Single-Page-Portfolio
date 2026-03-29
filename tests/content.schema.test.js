const fs = require("fs");
const path = require("path");
const { contentSchema } = require("../server/contentSchema");

describe("Content schema", () => {
  test("accepts current content.json payload", () => {
    const filePath = path.join(__dirname, "..", "server", "data", "content.json");
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);

    const result = contentSchema.safeParse(parsed);

    expect(result.success).toBe(true);
  });

  test("rejects invalid nav links", () => {
    const invalid = {
      seo: {
        title: "x",
        description: "x",
        keywords: "x",
        author: "x",
        ogTitle: "x",
        ogDescription: "x",
        ogType: "website",
        ogUrl: "https://example.com",
      },
      nav: {
        logoText: "B",
        links: [{ href: "", label: "Home" }],
        mobileFooterLinks: [{ href: "#", label: "Link" }],
      },
      hero: {},
      sections: {},
      origin: {},
      about: {},
      skills: {},
      work: {},
      journey: {},
      contact: {},
      footer: {},
    };

    const result = contentSchema.safeParse(invalid);

    expect(result.success).toBe(false);
  });
});
