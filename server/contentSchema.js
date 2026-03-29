const { z } = require("zod");

const linkSchema = z.object({
  href: z.string().min(1),
  label: z.string().min(1),
});

const contentSchema = z
  .object({
    seo: z.object({
      title: z.string(),
      description: z.string(),
      keywords: z.string(),
      author: z.string(),
      ogTitle: z.string(),
      ogDescription: z.string(),
      ogType: z.string(),
      ogUrl: z.string(),
    }),
    nav: z.object({
      logoText: z.string(),
      links: z.array(linkSchema),
      mobileFooterLinks: z.array(linkSchema),
    }),
    hero: z.record(z.any()),
    sections: z.record(z.any()),
    origin: z.record(z.any()),
    about: z.record(z.any()),
    skills: z.record(z.any()),
    work: z.record(z.any()),
    journey: z.record(z.any()),
    contact: z.record(z.any()),
    footer: z.record(z.any()),
  })
  .passthrough();

module.exports = {
  contentSchema,
};
