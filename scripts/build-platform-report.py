#!/usr/bin/env python3
"""Build the VEGA platform function & expansion report as a PDF."""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "vega-platform-report.pdf")

# ----------------------------------------------------------------- palette
INK = colors.HexColor("#14202A")
PRIMARY = colors.HexColor("#0E4C5C")
PRIMARY_DK = colors.HexColor("#08333E")
ACCENT = colors.HexColor("#2A9D8F")
AMBER = colors.HexColor("#B7791F")
MUTED = colors.HexColor("#5B6670")
RULE = colors.HexColor("#D7DEE2")
BAND = colors.HexColor("#F1F5F6")
ZEBRA = colors.HexColor("#F7FAFA")
WHITE = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm
CONTENT_W = PAGE_W - 2 * MARGIN

# ----------------------------------------------------------------- styles
ss = getSampleStyleSheet()


def st(name, **kw):
    base = kw.pop("parent", ss["Normal"])
    return ParagraphStyle(name, parent=base, **kw)


S = {
    "cover_kicker": st("ck", fontName="Helvetica-Bold", fontSize=9.5, leading=13,
                       textColor=colors.HexColor("#9FD3CE"), spaceAfter=0),
    "cover_title": st("ct", fontName="Helvetica-Bold", fontSize=30, leading=35,
                      textColor=WHITE, spaceBefore=10, spaceAfter=6),
    "cover_sub": st("cs", fontName="Helvetica", fontSize=12.5, leading=18,
                    textColor=colors.HexColor("#CFE0E4")),
    "cover_meta": st("cm", fontName="Helvetica", fontSize=9, leading=14, textColor=MUTED),
    "h1": st("h1", fontName="Helvetica-Bold", fontSize=19, leading=23, textColor=PRIMARY_DK,
             spaceBefore=2, spaceAfter=3),
    "h1num": st("h1n", fontName="Helvetica-Bold", fontSize=9.5, leading=12, textColor=ACCENT,
                spaceAfter=2),
    "h2": st("h2", fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=PRIMARY,
             spaceBefore=13, spaceAfter=5),
    "h3": st("h3", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=INK,
             spaceBefore=9, spaceAfter=3),
    "body": st("bd", fontName="Helvetica", fontSize=9.2, leading=13.4, textColor=INK,
               alignment=TA_JUSTIFY, spaceAfter=6),
    "lead": st("ld", fontName="Helvetica", fontSize=10.2, leading=15.2, textColor=colors.HexColor("#2C3A44"),
               alignment=TA_JUSTIFY, spaceAfter=8),
    "small": st("sm", fontName="Helvetica", fontSize=8.2, leading=11.4, textColor=MUTED,
                spaceAfter=4),
    "cell": st("cl", fontName="Helvetica", fontSize=8.1, leading=10.8, textColor=INK),
    "cellb": st("clb", fontName="Helvetica-Bold", fontSize=8.1, leading=10.8, textColor=INK),
    "cellm": st("clm", fontName="Helvetica", fontSize=8.1, leading=10.8, textColor=MUTED),
    "code": st("cd", fontName="Courier-Bold", fontSize=7.0, leading=9.8, textColor=PRIMARY_DK),
    "codes": st("cds", fontName="Courier", fontSize=7.0, leading=9.8, textColor=INK),
    "th": st("th", fontName="Helvetica-Bold", fontSize=8.1, leading=10.6, textColor=WHITE),
    "toc": st("tc", fontName="Helvetica", fontSize=9.5, leading=17, textColor=INK),
    "point_t": st("pt", fontName="Helvetica-Bold", fontSize=8.8, leading=11.6, textColor=PRIMARY_DK),
    "point_b": st("pb", fontName="Helvetica", fontSize=8.5, leading=11.6, textColor=colors.HexColor("#33414B")),
    "note": st("nt", fontName="Helvetica", fontSize=8.6, leading=12.4, textColor=colors.HexColor("#2C3A44"),
               alignment=TA_JUSTIFY),
    "area_t": st("at", fontName="Helvetica-Bold", fontSize=13, leading=16.5, textColor=WHITE,
                 spaceAfter=2),
    "area_s": st("as", fontName="Helvetica", fontSize=8.4, leading=11.5,
                 textColor=colors.HexColor("#B9D8DD")),
    "area_l": st("al", fontName="Helvetica-Bold", fontSize=15, leading=17, textColor=WHITE),
}


def P(text, style="body"):
    return Paragraph(text, S[style])


# ----------------------------------------------------------------- helpers
def section(number, title, standfirst=None):
    out = [Paragraph(number, S["h1num"]), Paragraph(title, S["h1"]),
           rule(ACCENT, 42 * mm, 1.6), Spacer(1, 7)]
    if standfirst:
        out.append(Paragraph(standfirst, S["lead"]))
    return out


def rule(color=RULE, width=CONTENT_W, thickness=0.7):
    t = Table([[""]], colWidths=[width], rowHeights=[thickness])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), color),
                           ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                           ("TOPPADDING", (0, 0), (-1, -1), 0),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    return t


def table(header, rows, widths, aligns=None, styles=None, font_first_code=True):
    """Build a themed table. `styles` is a per-column style key list."""
    styles = styles or (["code"] + ["cell"] * (len(header) - 1) if font_first_code
                        else ["cell"] * len(header))
    data = [[Paragraph(h, S["th"]) for h in header]]
    for r in rows:
        data.append([Paragraph(c, S[styles[i]]) for i, c in enumerate(r)])

    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.2),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
        ("LINEBELOW", (0, 0), (-1, 0), 0, PRIMARY),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            cmds.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    if aligns:
        for col, al in enumerate(aligns):
            cmds.append(("ALIGN", (col, 0), (col, -1), al))
    t.setStyle(TableStyle(cmds))
    return t


def callout(title, body, color=ACCENT, bg=colors.HexColor("#EEF7F5")):
    inner = [[Paragraph(f"<b>{title}</b>", S["point_t"])], [Paragraph(body, S["note"])]]
    t = Table(inner, colWidths=[CONTENT_W - 8 * mm], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (0, 0), 7),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 7),
        ("TOPPADDING", (0, 1), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
        ("LINEBEFORE", (0, 0), (0, -1), 2.4, color),
    ]))
    return t


def points_table(points, start=1):
    """Numbered expansion points, two-column: index badge + title/description."""
    data = []
    for i, (title, body) in enumerate(points, start=start):
        badge = Paragraph(f'<font color="#FFFFFF"><b>{i:02d}</b></font>', S["cellb"])
        txt = [Paragraph(title, S["point_t"]), Paragraph(body, S["point_b"])]
        data.append([badge, txt])

    t = Table(data, colWidths=[10 * mm, CONTENT_W - 10 * mm], hAlign="LEFT")
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, -1), 4),
        ("LEFTPADDING", (1, 0), (1, -1), 7),
        ("RIGHTPADDING", (1, 0), (1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
    ]
    for i in range(len(data)):
        cmds += [("BACKGROUND", (0, i), (0, i), PRIMARY if i % 2 == 0 else ACCENT),
                 ("ALIGN", (0, i), (0, i), "CENTER")]
    t.setStyle(TableStyle(cmds))
    return t


def area_header(letter, title, subtitle):
    head = Table(
        [[Paragraph(letter, S["area_l"]),
          [Paragraph(title, S["area_t"]), Paragraph(subtitle, S["area_s"])]]],
        colWidths=[13 * mm, CONTENT_W - 13 * mm], hAlign="LEFT")
    head.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_DK),
        ("BACKGROUND", (0, 0), (0, 0), ACCENT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, 0), "CENTER"),
        ("LEFTPADDING", (1, 0), (1, 0), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return head


# ----------------------------------------------------------------- canvas
DOC_TITLE = "VEGA Platform — Function Report & Expansion Proposal"


def draw_cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PRIMARY_DK)
    canvas.rect(0, PAGE_H - 118 * mm, PAGE_W, 118 * mm, stroke=0, fill=1)
    canvas.setFillColor(ACCENT)
    canvas.rect(0, PAGE_H - 121 * mm, PAGE_W, 3 * mm, stroke=0, fill=1)
    # decorative water-line motif
    canvas.setStrokeColor(colors.HexColor("#1B6273"))
    canvas.setLineWidth(0.8)
    for i in range(7):
        y = PAGE_H - 118 * mm + 7 * mm + i * 4.2 * mm
        canvas.line(PAGE_W - 74 * mm + i * 4.5 * mm, y, PAGE_W - 18 * mm, y)
    canvas.restoreState()


def draw_page(canvas, doc):
    canvas.saveState()
    # header rule
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.6)
    canvas.line(MARGIN, PAGE_H - MARGIN + 6 * mm, PAGE_W - MARGIN, PAGE_H - MARGIN + 6 * mm)
    canvas.setFont("Helvetica", 7.4)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, PAGE_H - MARGIN + 8.4 * mm, DOC_TITLE)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - MARGIN + 8.4 * mm, "VEGA / drills-patrick")
    # footer
    canvas.line(MARGIN, MARGIN - 6 * mm, PAGE_W - MARGIN, MARGIN - 6 * mm)
    canvas.setFont("Helvetica", 7.4)
    canvas.drawString(MARGIN, MARGIN - 10 * mm, "Internal technical documentation")
    canvas.setFillColor(PRIMARY)
    canvas.setFont("Helvetica-Bold", 8.2)
    canvas.drawRightString(PAGE_W - MARGIN, MARGIN - 10 * mm, str(canvas.getPageNumber()))
    canvas.restoreState()


# ================================================================== CONTENT
story = []

# ---------------------------------------------------------------- COVER
story += [
    Spacer(1, 34 * mm),
    P("TECHNICAL REPORT &nbsp;·&nbsp; AUGUST 2026", "cover_kicker"),
    P("VEGA Platform", "cover_title"),
    P("Front-end and back-office function inventory, environment "
      "configuration, and a five-area expansion proposal", "cover_sub"),
    Spacer(1, 52 * mm),
]

cover_facts = [
    ["Repository", "Omega-Nodes-Company-LTD / drills-patrick"],
    ["Application", "VEGA — multilingual website and administration area for a "
                    "Ugandan water-well drilling company"],
    ["Stack", "Next.js 15 (App Router, Server Actions) · TypeScript strict · "
              "PostgreSQL 18 + pgvector · Drizzle ORM · Tailwind CSS v4"],
    ["Languages", "English, French, Italian, German, Luganda (next-intl, "
                  "<font face='Courier'>localePrefix: as-needed</font>)"],
    ["Scope of report", "Public site, partner portal, machine-readable endpoints, "
                        "administration area, API and scheduled jobs, environment variables"],
    ["Deployment", "Docker (standalone output) on Coolify · migrations applied "
                   "from the container entrypoint · health probe at "
                   "<font face='Courier'>/api/health</font>"],
]
ct = Table([[Paragraph(k, S["cellb"]), Paragraph(v, S["cell"])] for k, v in cover_facts],
           colWidths=[32 * mm, CONTENT_W - 32 * mm], hAlign="LEFT")
ct.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
]))
story += [ct, Spacer(1, 8),
          P("Compiled from a direct reading of the repository source tree. Every "
            "function, route, action and variable listed below was verified "
            "against the code, not inferred from documentation.", "cover_meta")]

story.append(NextPageTemplate("body"))
story.append(PageBreak())

# ---------------------------------------------------------------- TOC
story += section("CONTENTS", "What is in this document")

toc_rows = [
    ("1", "Architecture at a glance", "How the pieces fit: routing, rendering, data and trust boundaries"),
    ("2", "Front-end functions", "Public routes, server actions, section blocks, components, machine-readable endpoints"),
    ("3", "Back-office functions", "Admin routes, roles and permissions, the complete server-action inventory"),
    ("4", "Environment variables", "Required, feature-gating, build-time and operational variables"),
    ("5", "Platform services", "API routes, scheduled jobs, payments, search, media, mail, SEO"),
    ("6", "Expansion proposal", "Five macro areas, twelve concrete points each — sixty proposals in total"),
    ("7", "Sequencing", "A proposed ordering across the five areas for a first quarter of work"),
]
story.append(table(
    ["§", "Section", "Contents"],
    toc_rows,
    [10 * mm, 48 * mm, CONTENT_W - 58 * mm],
    styles=["cellb", "cellb", "cellm"],
))
story += [Spacer(1, 9)]
story.append(callout(
    "How to read the inventories",
    "Tables list the exported symbol or route exactly as it appears in the source, followed by the "
    "file it lives in and what it does. Anything marked <b>gated</b> is inactive until the "
    "corresponding environment variable is present — the application degrades to a working "
    "subset rather than failing to boot.",
))

story.append(PageBreak())

# ---------------------------------------------------------------- 1. ARCH
story += section(
    "SECTION 1", "Architecture at a glance",
    "The application is a single Next.js 15 deployment that serves three distinct audiences from "
    "one codebase and one database: the public visitor, the institutional partner, and the "
    "operator in the administration area. Rendering is server-first — data is read in server "
    "components and mutated through Server Actions, so almost nothing of the domain logic is "
    "shipped to the browser.")

story += [P("Four surfaces, one deployment", "h2")]
story.append(table(
    ["Surface", "Path space", "Access", "Purpose"],
    [
        ["Public site", "/[locale]/(site)/*", "Anonymous",
         "Marketing, project register, transparency data, donations, search, fault reporting"],
        ["Partner portal", "/[locale]/(site)/portal/*", "Partner-contact session cookie",
         "Project status, documents and e-signature, maintenance contracts"],
        ["Administration", "/[locale]/admin/*", "Staff session cookie + role permission",
         "Content, projects, field operations, fundraising, appearance, settings, users, audit"],
        ["Machine surface", "/api/*, /*.json, /*.csv, /embed/*, /llms*.txt, /feed.xml",
         "Anonymous, secret or session depending on route",
         "Webhooks, uploads, RAG chat, cron jobs, open data, syndication, AI discovery"],
    ],
    [26 * mm, 38 * mm, 32 * mm, CONTENT_W - 96 * mm],
    styles=["cellb", "code", "cell", "cellm"],
))

story += [P("Rendering, routing and i18n", "h2"),
          P("Locale handling is done by <font face='Courier'>next-intl</font> middleware over every "
            "path except <font face='Courier'>/api</font>, <font face='Courier'>/embed</font>, Next "
            "internals and static files. The default locale (<b>en</b>) is served without a prefix; "
            "the other four are prefixed. Translation is deliberately split across two mechanisms: "
            "structured entities (articles, projects, campaigns, pages) have companion "
            "<font face='Courier'>*_translations</font> tables carrying a per-language slug and SEO "
            "metadata, while page sections are laid out once and carry i18n objects "
            "(<font face='Courier'>{ en: …, it: … }</font>) on their text fields. A layout is "
            "therefore arranged a single time and only the copy is translated; missing translations "
            "fall back to the default locale rather than rendering blank."),
          ]

story += [P("Data model", "h2"),
          P("Fifty-four tables across ten Drizzle schema files, one file per domain:")]
story.append(table(
    ["Schema file", "Tables", "Domain"],
    [
        ["auth.ts", "users, password_reset_tokens, audit_log", "Staff accounts, roles, audit trail"],
        ["content.ts", "pages, posts, categories, tags, their translations, post_tags, slug_redirects",
         "Editorial content and retired-slug redirects"],
        ["projects.ts", "projects, project_translations, project_updates, project_update_translations",
         "Water points and their published updates"],
        ["ngo.ts", "ngo_contacts, partner_projects, project_documents, drilling_rates, quotes, "
                   "maintenance_contracts, contract_projects, maintenance_visits, fault_reports, "
                   "document_signatures",
         "Institutional relationships and field operations"],
        ["fundraising.ts", "campaigns, campaign_translations, donations, donation_events",
         "Campaigns, donations and provider event log"],
        ["transparency.ts", "water_point_readings, impact_indicators, spending_entries (+ translations)",
         "Published evidence: yield readings, indicators, spending"],
        ["crm.ts", "partners, team_members, testimonials, faqs (+ translations), ngo_inquiries, "
                   "contact_submissions, newsletter_subscribers",
         "Editable collections and inbound contact"],
        ["settings.ts", "site_settings, themes, navigation_menus", "Design tokens, identity, menus"],
        ["media.ts", "media", "Object-storage-backed media library"],
        ["vectors.ts", "content_embeddings, chat_conversations, chat_messages",
         "pgvector index and RAG assistant transcripts"],
    ],
    [24 * mm, 60 * mm, CONTENT_W - 84 * mm],
    styles=["code", "cellm", "cell"],
))

story += [Spacer(1, 8)]
story.append(callout(
    "Design principle worth preserving",
    "Only three environment variables are required. Every other integration is a feature gate: when "
    "its variables are absent the feature reports itself as not configured and the rest of the "
    "application keeps working. This is what makes the payment providers, the embedding pipeline and "
    "the media library independently optional — and it is the property any expansion should respect.",
))

story.append(PageBreak())

# ---------------------------------------------------------------- 2. FRONTEND
story += section(
    "SECTION 2", "Front-end functions",
    "Everything a visitor, donor, journalist or partner contact can reach without an administration "
    "account. Twenty-three public page routes, eleven public Server Actions, nineteen section block types "
    "and a machine-readable surface designed to be cited rather than scraped.")

story += [P("2.1 · Public page routes", "h2"),
          P("File paths are relative to <font face='Courier'>src/app/[locale]/(site)/</font>.", "small")]
story.append(table(
    ["Route", "File", "Function"],
    [
        ["/", "page.tsx", "Home page, composed from database-driven sections"],
        ["/[slug]", "[slug]/page.tsx",
         "Any CMS page by translated slug, with retired-slug redirect resolution"],
        ["/projects", "projects/page.tsx",
         "Water-point index with filters (district, status, type) and pagination"],
        ["/projects/[slug]", "projects/[slug]/page.tsx",
         "Project detail: gallery, before/after, readings chart, documents, updates, structured data"],
        ["/blog", "blog/page.tsx", "Article index with category filter and pagination"],
        ["/blog/[slug]", "blog/[slug]/page.tsx",
         "Article with author profile, reading time, share buttons and JSON-LD"],
        ["/campaigns", "campaigns/page.tsx", "Fundraising campaign index with progress bars"],
        ["/campaigns/[slug]", "campaigns/[slug]/page.tsx",
         "Campaign detail with live total and inline donation entry"],
        ["/donate", "donate/page.tsx",
         "Donation form: currency, suggested and free amounts, provider selection"],
        ["/donate/status", "donate/status/page.tsx",
         "Post-checkout state, polling the provider until the payment resolves"],
        ["/data", "data/page.tsx",
         "Public register of every water point — sortable table, no account, downloadable"],
        ["/spending", "spending/page.tsx", "Spending broken down by year and category"],
        ["/updates", "updates/page.tsx", "Chronological feed of published project updates"],
        ["/capabilities", "capabilities/page.tsx",
         "Capability statement computed from the delivery record — built to print to PDF"],
        ["/search", "search/page.tsx",
         "Hybrid search results, keyword always, semantic when embeddings are configured"],
        ["/faq", "faq/page.tsx", "Accordion of published FAQ entries with FAQPage JSON-LD"],
        ["/team", "team/page.tsx", "Team collection with per-locale biographies"],
        ["/partners", "partners/page.tsx", "Partner directory with descriptions"],
        ["/report/[slug]", "report/[slug]/page.tsx",
         "Fault report for one water point, reached from a QR sticker; noindex by design"],
        ["/portal/login", "portal/login/page.tsx", "Partner-contact sign-in"],
        ["/portal", "portal/page.tsx", "Partner dashboard: assigned projects and SLA figures"],
        ["/portal/documents", "portal/documents/page.tsx",
         "Partner document list with in-browser signature capture"],
        ["/portal/contracts", "portal/contracts/page.tsx",
         "Maintenance contracts, visit history and next-visit-due dates"],
    ],
    [31 * mm, 42 * mm, CONTENT_W - 73 * mm],
    styles=["code", "codes", "cell"],
))

story.append(PageBreak())

story += [P("2.2 · Public Server Actions", "h2"),
          P("All mutations from the public surface go through Server Actions with Zod validation, "
            "in-process rate limiting keyed on the client identifier, and a typed "
            "<font face='Courier'>ActionResult</font> return shape.")]
story.append(table(
    ["Function", "File", "Behaviour"],
    [
        ["subscribeNewsletter()", "actions/public.ts",
         "Validates the address, stores the subscriber, tolerates repeat submissions"],
        ["submitContact()", "actions/public.ts",
         "Stores the message and notifies the configured mailbox"],
        ["submitNgoInquiry()", "actions/public.ts",
         "Institutional enquiry — organisation, volume, districts — routed into the admin queue"],
        ["reportFault()", "actions/public.ts",
         "Fault report against one water point; allocates a reference and notifies the team"],
        ["startDonation()", "actions/donate.ts",
         "Creates the donation row, allocates a reference and opens checkout with the chosen provider "
         "(rate limit: 10 per 10 minutes per client)"],
        ["signIn() / signOut()", "actions/auth.ts",
         "Staff authentication: bcrypt verification, signed JWT session cookie, audit entry"],
        ["partnerSignIn() / partnerSignOut()", "actions/partner.ts",
         "Partner-contact authentication against a separate session cookie"],
        ["requirePartner()", "actions/partner.ts",
         "Guard used by every portal page; redirects to the portal login when absent"],
        ["signDocument()", "actions/portal-signature.ts",
         "Records a signature bound to a content fingerprint, so a signed document cannot be "
         "silently replaced"],
    ],
    [38 * mm, 33 * mm, CONTENT_W - 71 * mm],
    styles=["code", "codes", "cell"],
))

story += [P("2.3 · Section block types", "h2"),
          P("Pages are composed from typed, validated blocks. Each block carries its own layout "
            "envelope — spacing above and below, width (narrow / container / wide / full), background "
            "tone and anchor id — so spacing is adjustable globally through the theme "
            "<i>and</i> per section.")]

blocks = [
    ("hero", "Headline, standfirst, media and call-to-action pair"),
    ("richText", "Sanitised WYSIWYG prose, per locale"),
    ("stats", "Impact figures, optionally computed from the project record"),
    ("projects", "Curated or filtered water-point cards"),
    ("posts", "Article cards, filterable by category"),
    ("campaigns", "Campaign cards with progress"),
    ("donate", "Inline donation box bound to a campaign or general fund"),
    ("gallery", "Media grid from the library"),
    ("partners", "Partner logo wall"),
    ("testimonials", "Quotes with attribution"),
    ("team", "Team member cards with initials fallback"),
    ("faq", "Selected FAQ entries with FAQPage structured data"),
    ("steps", "How-it-works sequence"),
    ("cta", "Standalone call to action"),
    ("map", "Leaflet map of project markers with zoom-aware clustering"),
    ("video", "YouTube/Vimeo embed through the sanitiser's allowed hosts"),
    ("contact", "Contact form block"),
    ("answer", "Question-and-answer block written for answer engines"),
    ("table", "Structured data table"),
]
rows = []
for i in range(0, len(blocks), 2):
    left = blocks[i]
    right = blocks[i + 1] if i + 1 < len(blocks) else ("", "")
    rows.append([left[0], left[1], right[0], right[1]])
story.append(table(
    ["Block", "Renders", "Block", "Renders"],
    rows,
    [23 * mm, (CONTENT_W - 46 * mm) / 2, 23 * mm, (CONTENT_W - 46 * mm) / 2],
    styles=["code", "cellm", "code", "cellm"],
))

story.append(PageBreak())

story += [P("2.4 · Interactive components", "h2")]
story.append(table(
    ["Component", "Function"],
    [
        ["site-header / mobile-nav / site-footer",
         "Database-driven header, footer and legal menus with translated labels and highlight flags"],
        ["language-switcher", "Switches locale while preserving the translated slug of the current entity"],
        ["theme-toggle / theme-style",
         "Light–dark switch over CSS custom properties emitted from the active theme row"],
        ["project-filters", "District, status and type filters driven through the URL query string"],
        ["projects-map / projects-map-canvas",
         "Leaflet map with grid clustering computed server-side by zoom level"],
        ["readings-chart", "Yield and water-level readings over time for a single water point"],
        ["registry-table", "Sortable public register with CSV and JSON download links"],
        ["before-after", "Draggable before/after image comparison"],
        ["donation-form / donation-status-panel",
         "Currency and amount selection, provider list built from what is actually configured; the "
         "status panel polls until the payment resolves"],
        ["contact-form / newsletter-form / ngo-inquiry-form / fault-report-form",
         "Public submission forms, each bound to its Server Action and rate limit"],
        ["chat-widget", "RAG assistant; answers only from indexed content and cites its sources"],
        ["signature-pad", "Canvas signature capture used by the partner portal"],
        ["share-buttons / pagination / cards / faq-accordion",
         "Shared presentation primitives across listings and detail pages"],
    ],
    [46 * mm, CONTENT_W - 46 * mm],
    styles=["code", "cell"],
))

story += [P("2.5 · Machine-readable and syndication surface", "h2"),
          P("A distinct and unusually complete part of the front end: the site is built to be read by "
            "software — funders' spreadsheets, partner websites, search crawlers and answer engines — "
            "not only by people.")]
story.append(table(
    ["Endpoint", "Format", "Function"],
    [
        ["/projects.json", "JSON", "Every published water point as data, licence stated in the payload, "
                                   "unpaginated up to 1 000 records"],
        ["/data.csv", "CSV", "The same register as a spreadsheet, licence in a comment line so it "
                             "survives being emailed on"],
        ["/embed/impact", "SVG", "Badge a partner can paste into their own CMS as an "
                                 "<font face='Courier'>&lt;img&gt;</font>; live figure, link back, "
                                 "cannot execute anything on their page"],
        ["/feed.xml", "RSS", "Article feed, root and per-locale"],
        ["/llms.txt", "Text", "Compact index of the site for language models, root and per-locale"],
        ["/llms-full.txt", "Text", "Expanded corpus for the same audience"],
        ["/sitemap.xml", "XML", "Generated from published entities across all active locales"],
        ["/robots.txt", "Text", "Generated; API paths carry X-Robots-Tag noindex at the header level"],
        ["opengraph-image", "PNG", "Per-entity social images generated for posts, projects and campaigns"],
    ],
    [30 * mm, 16 * mm, CONTENT_W - 46 * mm],
    styles=["code", "cellm", "cell"],
))

story.append(PageBreak())

# ---------------------------------------------------------------- 3. BACKOFFICE
story += section(
    "SECTION 3", "Back-office functions",
    "The administration area at <font face='Courier'>/admin</font> covers twenty-three screens across "
    "five groups, guarded by a three-role permission model, and mutating through forty-seven Server "
    "Actions. Everything the public site shows is editable here — including its colours, spacing and "
    "typography.")

story += [P("3.1 · Roles and permissions", "h2")]
story.append(table(
    ["Role", "Permissions", "Practical scope"],
    [
        ["admin", "content, media, projects, donations, inquiries, appearance, settings, users",
         "Unrestricted"],
        ["editor", "content, media, projects, inquiries, appearance",
         "Everything editorial and operational; no access to donations, settings or user management"],
        ["finance", "donations, inquiries",
         "Donation reconciliation and the enquiry queue only"],
    ],
    [20 * mm, 62 * mm, CONTENT_W - 82 * mm],
    styles=["code", "cellm", "cell"],
))
story += [Spacer(1, 4),
          P("Permissions are enforced in three places: <font face='Courier'>requireUser()</font> and "
            "<font face='Courier'>requirePermission()</font> guard server-side page and action entry, "
            "<font face='Courier'>requireApiUser()</font> guards the API routes, and the navigation "
            "itself hides entries the current role cannot open. Sessions are signed JWTs "
            "(<font face='Courier'>jose</font>) in an HTTP-only cookie; passwords are bcrypt hashes "
            "with a strength check at the point of entry.", "small")]

story += [P("3.2 · Administration screens", "h2")]
story.append(table(
    ["Group", "Screen", "Function"],
    [
        ["Dashboard", "/admin",
         "Totals raised overall and this month, pending donations, active campaigns, project counts by "
         "status, beneficiaries, new enquiries, draft count, recent donations, integration status"],
        ["Content", "/admin/pages",
         "Section-by-section page builder with per-block layout controls and SEO fields"],
        ["", "/admin/posts", "Articles with TipTap editor, categories, tags, author and scheduling"],
        ["", "/admin/categories", "Category and tag taxonomy with translations"],
        ["", "/admin/projects",
         "Water points: location to district and village, depth, yield, beneficiaries, status, gallery, "
         "documents, readings, maintenance visits and updates"],
        ["", "/admin/campaigns", "Fundraising campaigns with target, currency and live total"],
        ["", "/admin/faults", "Fault queue with SLA cards — response and resolution medians"],
        ["", "/admin/quotes", "Drilling rate cards and quote builder with generated reference"],
        ["", "/admin/contracts", "Maintenance contracts, covered projects and visit intervals"],
        ["", "/admin/media", "Library browser, folders, upload, alt text, deletion"],
        ["Collections", "/admin/faqs · /team · /partners · /testimonials",
         "Four generic collections driven by one field-definition registry"],
        ["Fundraising", "/admin/donations",
         "Donation table with confirm, mark-failed, resend-receipt and manual-record actions"],
        ["", "/admin/inquiries", "Institutional enquiry pipeline with status"],
        ["", "/admin/messages", "Contact submissions and newsletter subscribers"],
        ["Settings", "/admin/appearance",
         "Theme editor (palettes, fonts, scale, radius, shadow, spacing, section presets) and the "
         "header/footer/legal menu editor"],
        ["", "/admin/settings",
         "Identity, logos, active and default languages, contact details, social links, SEO defaults, "
         "legal and registry details, currencies and suggested amounts, bank transfer details, feature "
         "toggles, integration self-tests"],
        ["", "/admin/users", "Staff accounts and role assignment"],
        ["", "/admin/partner-access", "Partner contacts, portal credentials and project assignment"],
        ["", "/admin/transparency", "Readings, impact indicators and spending entries"],
        ["", "/admin/audit", "Audit trail of administrative actions"],
    ],
    [20 * mm, 42 * mm, CONTENT_W - 62 * mm],
    styles=["cellb", "code", "cell"],
))

story.append(PageBreak())

story += [P("3.3 · Administrative Server Actions", "h2"),
          P("Forty-seven exported actions under <font face='Courier'>src/app/actions/admin/</font>. Each "
            "checks a permission, validates with Zod, writes an audit entry where it matters, "
            "revalidates the affected cache tags, and re-indexes embeddings in the background when "
            "published content changes.")]

story.append(table(
    ["File", "Exported functions"],
    [
        ["content.ts", "savePost · saveProject · saveCampaign · savePage · saveCategory · deleteEntity · "
                       "setPublishStatus"],
        ["collections.ts", "saveCollectionItem · deleteCollectionItem — one pair for FAQ, team, "
                           "partner and testimonial"],
        ["transparency.ts", "saveReading · deleteReading · saveIndicator · deleteIndicator · "
                            "saveSpendingEntry · deleteSpendingEntry"],
        ["donations.ts", "confirmDonation · markDonationFailed · resendReceipt · recordManualDonation"],
        ["faults.ts", "updateFault · saveMaintenanceVisit · deleteMaintenanceVisit"],
        ["quotes.ts", "saveDrillingRate · deleteDrillingRate · createQuote"],
        ["contracts.ts", "saveContract · deleteContract"],
        ["documents.ts", "saveProjectDocument · deleteProjectDocument"],
        ["project-updates.ts", "saveProjectUpdate · deleteProjectUpdate"],
        ["partner-access.ts", "savePartnerContact · deletePartnerContact · setPartnerProjects"],
        ["appearance.ts", "saveTheme · resetTheme · saveNavigation"],
        ["settings.ts", "saveSettings · testIntegration"],
        ["media.ts", "updateMedia · removeMedia"],
        ["messages.ts", "setContactHandled · deleteContactSubmission · deleteSubscriber"],
        ["inquiries.ts", "updateInquiry"],
        ["users.ts", "saveUser · deleteUser"],
    ],
    [33 * mm, CONTENT_W - 33 * mm],
    styles=["code", "cell"],
))

story += [P("3.4 · Supporting back-office libraries", "h2")]
story.append(table(
    ["Module", "Key functions", "Purpose"],
    [
        ["lib/admin/queries.ts",
         "adminListPosts · adminListProjects · adminListCampaigns · adminListPages · adminGetPost · "
         "adminGetProject · adminGetCampaign · adminGetPage · adminListProjectDocuments · "
         "adminListReadings · adminListMaintenanceVisits · adminListProjectUpdates · "
         "adminAuthorOptions · adminCategoryOptions · adminTagOptions · adminProjectOptions",
         "Every list and detail read behind the admin screens"],
        ["lib/admin/stats.ts", "dashboardStats · recentDonations", "Dashboard aggregates in a single round of parallel queries"],
        ["lib/admin/collections.ts", "tablesFor · listCollection · schemaFor · deleteCollectionRow",
         "One generic engine driving the four editable collections"],
        ["lib/audit.ts", "recordAudit · listAuditEntries", "Append-only administrative trail"],
        ["lib/theme/tokens.ts", "parseThemeTokens · themeToCss · defaultThemeTokens",
         "Design tokens validated then compiled to CSS custom properties, applied without a rebuild"],
        ["lib/settings/service.ts", "getSiteSettings · getActiveTheme · getNavigation · revalidate*",
         "Cached settings reads with explicit tag invalidation"],
        ["lib/media/*", "storeUpload · isAllowedType · matchesDeclaredType · sanitizeSvg",
         "25 MB and 80 Mpx ceilings; refuses files whose bytes contradict their declared type; "
         "strips active content from SVG"],
    ],
    [38 * mm, 58 * mm, CONTENT_W - 96 * mm],
    styles=["code", "codes", "cell"],
))

story.append(PageBreak())

# ---------------------------------------------------------------- 4. ENV
story += section(
    "SECTION 4", "Environment variables",
    "Validated once at boot by a Zod schema in <font face='Courier'>src/env.ts</font>, which throws a "
    "readable list of problems rather than failing at first use. Three variables are required; every "
    "other one gates a feature and is reported as <i>not configured</i> when absent.")

story += [P("4.1 · Required", "h2")]
story.append(table(
    ["Variable", "Constraint", "Function"],
    [
        ["DATABASE_URL", "non-empty",
         "PostgreSQL 18 connection string; the database user needs rights to create the "
         "<font face='Courier'>vector</font> and <font face='Courier'>pg_trgm</font> extensions"],
        ["APP_URL", "trailing slashes stripped",
         "Public origin. Payment redirects, webhook callbacks, canonical URLs and the sitemap are all "
         "derived from it — it must match the deployed domain exactly"],
        ["AUTH_SECRET", "min. 16 characters",
         "Signs the session cookies. Generate with <font face='Courier'>openssl rand -base64 48</font>"],
    ],
    [34 * mm, 26 * mm, CONTENT_W - 60 * mm],
    styles=["code", "cellm", "cell"],
))

story += [P("4.2 · Object storage — gates the media library", "h2")]
story.append(table(
    ["Variable", "Default", "Function"],
    [
        ["S3_ENDPOINT", "—", "S3-compatible endpoint (Hetzner Object Storage in production). <b>Also read at build time</b>"],
        ["S3_REGION", "—", "Bucket region, e.g. <font face='Courier'>fsn1</font>"],
        ["S3_BUCKET", "—", "Bucket name"],
        ["S3_ACCESS_KEY_ID", "—", "Access key"],
        ["S3_SECRET_ACCESS_KEY", "—", "Secret key"],
        ["S3_PREFIX", "empty", "Folder inside the bucket reserved for this site; scopes every object key so one "
                               "bucket can host several sites. Leading and trailing slashes are normalised away"],
        ["S3_PUBLIC_BASE_URL", "${S3_ENDPOINT}/<br/>${S3_BUCKET}",
         "Public base for image URLs; point it at a CDN when one is present. <b>Also read at build time</b>"],
        ["S3_FORCE_PATH_STYLE", "false", "Path-style addressing — keep <font face='Courier'>true</font> for Hetzner"],
    ],
    [36 * mm, 30 * mm, CONTENT_W - 66 * mm],
    styles=["code", "cellm", "cell"],
))
story += [Spacer(1, 5)]
story.append(callout(
    "Build-time caveat",
    "Next.js compiles the list of hosts its image optimiser accepts, so <b>S3_ENDPOINT</b> and "
    "<b>S3_PUBLIC_BASE_URL</b> must be marked as build variables, not only runtime ones. If they are "
    "missing at build time the optimiser has no allowed host; the application detects this and falls "
    "back to serving originals unoptimised, so pictures still appear but are no longer resized or "
    "converted to WebP/AVIF.",
    color=AMBER, bg=colors.HexColor("#FDF6E7"),
))

story.append(PageBreak())

story += [P("4.3 · Payments — each provider is independently optional", "h2"),
          P("A provider appears in the donation form only when fully configured. Bank transfer is "
            "always available and is configured from the admin settings rather than the environment, "
            "so the form is never empty.")]
story.append(table(
    ["Variable", "Default", "Function"],
    [
        ["STRIPE_SECRET_KEY", "—", "Enables the Stripe provider"],
        ["STRIPE_WEBHOOK_SECRET", "—", "Signing secret; without it the Stripe webhook rejects every call"],
        ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "—", "Client-side publishable key"],
        ["PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET", "—", "Enable PayPal. No webhook needed — the order is captured on return"],
        ["PAYPAL_ENV", "sandbox", "<font face='Courier'>sandbox</font> | <font face='Courier'>live</font>"],
        ["PESAPAL_CONSUMER_KEY / PESAPAL_CONSUMER_SECRET", "—", "Enable PesaPal; the IPN URL registers itself on first checkout"],
        ["PESAPAL_ENV", "sandbox", "<font face='Courier'>sandbox</font> | <font face='Courier'>live</font>"],
        ["MTN_MOMO_SUBSCRIPTION_KEY / MTN_MOMO_API_USER / MTN_MOMO_API_KEY", "—", "Enable MTN Mobile Money"],
        ["MTN_MOMO_ENV / MTN_MOMO_TARGET_ENVIRONMENT", "sandbox", "Environment selection for the MoMo API"],
        ["AIRTEL_CLIENT_ID / AIRTEL_CLIENT_SECRET", "—", "Enable Airtel Money"],
        ["AIRTEL_ENV", "sandbox", "<font face='Courier'>sandbox</font> | <font face='Courier'>live</font>"],
        ["AIRTEL_COUNTRY", "UG", "ISO country for the Airtel collection API"],
        ["AIRTEL_CURRENCY", "UGX", "Collection currency"],
    ],
    [54 * mm, 16 * mm, CONTENT_W - 70 * mm],
    styles=["code", "cellm", "cell"],
))

story += [P("4.4 · Embeddings, RAG assistant, mail and jobs", "h2")]
story.append(table(
    ["Variable", "Default", "Function"],
    [
        ["EMBEDDINGS_API_KEY", "—",
         "Enables semantic search. Absent, search falls back to keyword matching and the chat widget is not rendered"],
        ["EMBEDDINGS_BASE_URL", "https://openrouter.ai/<br/>api/v1",
         "Any OpenAI-compatible <font face='Courier'>/embeddings</font> endpoint — no code change needed to switch provider"],
        ["EMBEDDINGS_MODEL", "openai/<br/>text-embedding-3-small", "Embedding model identifier"],
        ["EMBEDDINGS_DIM", "1536",
         "Must match the vector column dimension; the client refuses mismatched vectors rather than corrupting the index"],
        ["OPENROUTER_API_KEY", "—", "With embeddings present, enables the RAG chat assistant"],
        ["OPENROUTER_BASE_URL", "https://openrouter.ai/<br/>api/v1", "Chat completions endpoint"],
        ["RAG_CHAT_MODEL", "anthropic/<br/>claude-3.5-haiku", "Model used to compose grounded answers"],
        ["SMTP_URL", "—",
         "Enables receipts, bank-transfer instructions, partner reports and internal notifications. "
         "Absent, donations and form submissions still succeed"],
        ["MAIL_FROM", "no-reply@localhost", "Envelope sender"],
        ["CRON_SECRET", "—",
         "Bearer token protecting <font face='Courier'>/api/cron/*</font>. Absent, the jobs answer 401 to everyone"],
    ],
    [36 * mm, 34 * mm, CONTENT_W - 70 * mm],
    styles=["code", "codes", "cell"],
))

story += [P("4.5 · Build, bootstrap and test variables", "h2")]
story.append(table(
    ["Variable", "Where", "Function"],
    [
        ["NODE_ENV", "runtime", "development | test | production"],
        ["SKIP_ENV_VALIDATION", "build", "Lets <font face='Courier'>next build</font> run inside Docker without real "
                                         "credentials; the runtime container still validates on first access"],
        ["SKIP_MIGRATIONS", "entrypoint", "Set to <font face='Courier'>1</font> to stop the container applying "
                                          "migrations on boot — for multi-replica deployments"],
        ["SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME", "seed script",
         "Override the bootstrap administrator (defaults: admin@example.com / ChangeMe2026!)"],
        ["SEED_SITE_NAME", "seed script", "Site name written into the settings row on bootstrap"],
        ["E2E_BASE_URL / E2E_PORT / PLAYWRIGHT_CHROMIUM_PATH / CI", "tests",
         "Playwright target, port and browser binary; CI switches retry and worker behaviour"],
    ],
    [50 * mm, 20 * mm, CONTENT_W - 70 * mm],
    styles=["code", "cellm", "cell"],
))

story += [Spacer(1, 6)]
story.append(callout(
    "Feature gates derived from the environment",
    "<font face='Courier'>features.storage</font> · <font face='Courier'>embeddings</font> · "
    "<font face='Courier'>ragChat</font> · <font face='Courier'>mail</font> · "
    "<font face='Courier'>stripe</font> · <font face='Courier'>paypal</font> · "
    "<font face='Courier'>pesapal</font> · <font face='Courier'>mtn</font> · "
    "<font face='Courier'>airtel</font> — each is a boolean computed from the presence of its "
    "variables and surfaced in the admin dashboard, so an operator can see at a glance what is live.",
))

story.append(PageBreak())

# ---------------------------------------------------------------- 5. SERVICES
story += section(
    "SECTION 5", "Platform services",
    "The routes, jobs and libraries that sit behind both surfaces.")

story += [P("5.1 · API routes", "h2")]
story.append(table(
    ["Route", "Method", "Auth", "Function"],
    [
        ["/api/health", "GET", "none",
         "Executes <font face='Courier'>select 1</font>; 200 ok / 503 degraded. Used by the Docker "
         "HEALTHCHECK and the Coolify readiness probe"],
        ["/api/webhooks/[provider]", "POST, GET", "provider signature",
         "Single handler for Stripe, PesaPal, MTN and Airtel callbacks; events are claimed once "
         "(<font face='Courier'>claimProviderEvent</font>) so a redelivery cannot double-count a donation"],
        ["/api/donations/status", "GET", "reference + rate limit",
         "Re-asks the provider while the donation is open — this is what resolves mobile-money "
         "payments whose callback never arrives (120 per 5 min)"],
        ["/api/chat", "POST", "rate limit",
         "Streaming RAG assistant; retrieves context from the vector index and answers with citations "
         "(20 per 10 min). Gated on embeddings + OpenRouter"],
        ["/api/admin/media", "GET", "session + media", "Media library listing with folder and type filters"],
        ["/api/admin/media/upload", "POST", "session + media",
         "Upload with type sniffing, size and pixel ceilings, sharp derivatives, 60 s budget"],
        ["/api/admin/export", "GET", "session",
         "Flat project CSV in the column shape institutional funders ask for — ISO dates, "
         "machine-readable status, beneficiaries disaggregated as far as the data allows"],
        ["/api/cron/reconcile-donations", "GET", "CRON_SECRET bearer",
         "Confirms mobile-money payments whose callback never arrived; cancels donations open for "
         "more than 48 hours. Run every 10 minutes"],
        ["/api/cron/partner-reports", "GET", "CRON_SECRET bearer",
         "Sends the monthly or quarterly report to each partner contact who opted in, carrying the "
         "same figures the portal shows. Run daily"],
    ],
    [46 * mm, 15 * mm, 22 * mm, CONTENT_W - 83 * mm],
    styles=["code", "cellm", "cellm", "cell"],
))

story += [P("5.2 · Domain libraries", "h2")]
story.append(table(
    ["Area", "Key functions", "Notes"],
    [
        ["Payments", "getProvider · getConfiguredProvider · listAvailableProviders · providerStatuses · "
                     "providersSupporting · createDonation · createDonationReference · "
                     "applyDonationStatus · claimProviderEvent · recomputeCampaignTotal · campaignTotals",
         "Six providers behind one <font face='Courier'>PaymentProvider</font> interface: stripe, paypal, "
         "pesapal, mtn, airtel, bank"],
        ["Search", "search()", "Keyword pass always runs; vector pass added when embeddings are "
                               "configured, results merged per entity keeping the better score"],
        ["Embeddings", "embedTexts · embedOne · chunkText · indexDocument · indexDocumentInBackground · "
                       "removeDocument · embeddingStats · checkEmbeddingsConnection",
         "Publishing content triggers a background re-index; <font face='Courier'>pnpm reindex</font> "
         "rebuilds the whole index"],
        ["Field operations", "slaMetrics · listFaults · faultReference · median · projectForFaultReport · "
                             "faultReportQr",
         "Response and resolution medians; QR codes point a phone at the per-water-point report page"],
        ["Quoting", "applicableRates · buildQuote · quoteReference", "Rate cards resolved by depth band and region into a priced quote"],
        ["Partner portal", "partnerProjectIds · listPortalProjects · listPortalDocuments · "
                           "listPortalContracts · nextVisitDue",
         "Scoped strictly to the projects assigned to that partner"],
        ["Signatures", "documentFingerprint · signatureMatches · isSignatureImage",
         "A signature is bound to a content hash, so replacing the file invalidates the signature"],
        ["Transparency", "listRegistry · listReadings · listIndicators · listSpending · listRecentUpdates · "
                         "clusterMarkers",
         "Feeds the public register, spending page and map clustering"],
        ["SEO", "buildGraph · organisationNode · webSiteNode · webPageNode · breadcrumbNode · "
                "waterPointNode · faqPageNode · authorNode · buildAlternates · staticAlternates · "
                "listingRobots · buildLlmsIndex · buildLlmsFull · renderOgImage · renderFeed",
         "A single JSON-LD graph per page with stable node ids, plus hreflang alternates built from the "
         "translation tables"],
        ["Mail", "sendMail · renderEmail · verifyMailConnection · notifyContactSubmission · "
                 "notifyNgoInquiry · sendDonationReceipt · sendBankTransferInstructions · "
                 "notifyFaultReported · sendPartnerReport",
         "Every send is best-effort: a mail failure never fails the user's action"],
        ["Security", "sanitizeHtml · toEmbedUrl · rateLimit · clientIdentifier · hashPassword · "
                     "verifyPassword · passwordIssues · can · permissionsOf",
         "TipTap output is sanitised before storage, not on render"],
    ],
    [26 * mm, 62 * mm, CONTENT_W - 88 * mm],
    styles=["cellb", "codes", "cell"],
))

story.append(PageBreak())

story += [P("5.3 · Hardening already in place", "h2")]
story.append(table(
    ["Control", "Implementation"],
    [
        ["Content-Security-Policy", "No external script origin is allowed at all — payment providers are reached by "
                                    "redirect, never by an embedded SDK. <font face='Courier'>frame-src</font> is limited "
                                    "to the video hosts the sanitiser accepts"],
        ["Transport and framing", "HSTS with preload, <font face='Courier'>X-Frame-Options: DENY</font>, "
                                  "<font face='Courier'>frame-ancestors 'none'</font>, "
                                  "<font face='Courier'>nosniff</font>, strict-origin-when-cross-origin referrer"],
        ["Permissions-Policy", "camera, microphone, payment and interest-cohort disabled; geolocation restricted to self"],
        ["API indexing", "<font face='Courier'>X-Robots-Tag: noindex, nofollow</font> on every "
                         "<font face='Courier'>/api/*</font> response"],
        ["Rate limiting", "In-process, per client identifier: sign-in 10/10 min, donations 10/10 min, chat 20/10 min, "
                          "status polling 120/5 min"],
        ["Webhook idempotency", "Provider events are claimed in the database before being applied"],
        ["Upload safety", "Declared MIME type checked against the actual bytes; SVG stripped of active content; "
                          "25 MB and 80 Mpx ceilings"],
        ["Audit trail", "Administrative mutations are recorded and readable at /admin/audit"],
    ],
    [34 * mm, CONTENT_W - 34 * mm],
    styles=["cellb", "cell"],
))

story += [P("5.4 · Test coverage present today", "h2"),
          P("Thirteen Vitest unit suites — money, sanitisation, SLA medians, quotes, signatures, "
            "storage URLs, media sniffing, SEO graph, marker clustering, collections, content "
            "helpers, identity formatting, team block — plus one Playwright smoke spec running "
            "desktop and mobile. The pure domain logic is covered; the Server Actions, the payment "
            "providers and the portal flows are not.", "small")]

story.append(PageBreak())

# ---------------------------------------------------------------- 6. EXPANSION
story += section(
    "SECTION 6", "Expansion proposal",
    "Five macro areas, twelve points each — sixty proposals. They are ordered within each area from "
    "the smallest useful increment to the most structural, and every one is grounded in what the "
    "codebase already does: none requires abandoning a design decision that is currently working.")

story += [Spacer(1, 2)]
story.append(table(
    ["Area", "Theme", "Points", "Centre of gravity"],
    [
        ["A", "Fundraising and donor experience", "12", "Turning one-off gifts into a retained donor base"],
        ["B", "Field operations and asset lifecycle", "12", "From delivery record to operational asset management"],
        ["C", "Institutional partners and compliance", "12", "Making the portal the channel funders actually use"],
        ["D", "Content, discovery and AI visibility", "12", "Being found, cited and quoted correctly"],
        ["E", "Platform, security and operations", "12", "Scaling the deployment without losing its simplicity"],
    ],
    [11 * mm, 60 * mm, 14 * mm, CONTENT_W - 85 * mm],
    styles=["cellb", "cellb", "cellm", "cellm"],
))

story += [P("How the points were chosen", "h2"),
          P("Three filters were applied. First, <b>the codebase must already contain the hard part</b> — "
            "a proposal that would require replacing the session layer, the translation strategy or the "
            "payment abstraction was rejected in favour of one that extends them. Second, <b>the work "
            "must be visible to somebody outside the engineering team</b>: a donor, a district water "
            "officer, a compliance officer or an operator. Third, <b>the gap must be real today</b> — "
            "several points below exist because a table is present in the schema and nothing writes to "
            "it, or because a setting is exposed in the admin and nothing reads it."),
          P("Each area is presented as twelve numbered points, ordered from the smallest useful "
            "increment to the most structural. They are independent unless stated otherwise, so an area "
            "can be started anywhere in its list; where one point is a genuine precondition for another, "
            "the dependency is named in the text. Section 7 proposes an ordering across all five areas "
            "for a team that has to pick a first quarter of work.")]

story += [Spacer(1, 4)]
story.append(callout(
    "What is deliberately not proposed",
    "No headless-CMS migration, no move away from Server Actions, no rewrite of the block system, and no "
    "second data store. Those would be changes of direction rather than expansions, and the current "
    "architecture is not what is limiting this product — the limits are in what has not been built on "
    "top of it yet.",
))

story.append(PageBreak())

# --- AREA A
story += [area_header("A", "Fundraising and donor experience",
                      "Six providers and a reconciliation job already work. What is missing is "
                      "everything that happens after the first gift."),
          Spacer(1, 8)]
story.append(points_table([
    ("Recurring giving, end to end",
     "The <font face='Courier'>allowRecurring</font> setting and the <font face='Courier'>is_recurring</font> "
     "column exist but nothing drives them. Implement subscription creation on Stripe and PayPal, a "
     "schedule table for mobile-money re-prompts, and a donor-facing page to pause, change the amount or cancel."),
    ("Donor accounts",
     "A lightweight passwordless account — email link only — giving a donor their history, receipts and "
     "recurring plan. Reuse the partner-session pattern rather than inventing a third auth mechanism."),
    ("Annual tax statements",
     "One PDF per donor per fiscal year, generated from confirmed donations, in the donor's own language "
     "and with the legal details already stored in the organisation settings."),
    ("Gift attribution to a water point",
     "Let a donation be tied to a specific project rather than only to a campaign or the general fund, and "
     "show contributors the update feed for the point they funded — the strongest retention mechanism this domain has."),
    ("Abandoned-donation recovery",
     "The reconciliation job already knows which donations are open. Where an email address was captured, "
     "send a single reminder before the 48-hour cancellation, with a resume link."),
    ("Fee transparency and cover-the-fee",
     "Show the provider fee per method and offer the donor the option to cover it. On mobile money in "
     "particular, this changes the net materially."),
    ("Multi-currency presentation with a stored rate",
     "Amounts are stored in minor units per currency; add a daily exchange-rate snapshot so totals across "
     "currencies can be presented honestly, with the rate and its date shown."),
    ("Campaign milestones and matching",
     "Milestone thresholds with their own copy and imagery, plus matched-funding periods where a sponsor "
     "doubles gifts — both need only campaign-level fields and a display rule."),
    ("Peer-to-peer fundraising pages",
     "A supporter creates a sub-page under a campaign with their own target and story. Donations roll up "
     "to the parent campaign total, which <font face='Courier'>recomputeCampaignTotal</font> already models."),
    ("In-memory and tribute gifts",
     "A dedication field, an optional notification email to a third party, and a printable card — small "
     "work, and it consistently lifts average gift size."),
    ("Donation analytics in the dashboard",
     "The dashboard shows totals; add cohort retention, average gift by provider and currency, conversion "
     "from the donate page, and provider failure rates — the figures that decide where to spend effort."),
    ("Offline and institutional gift ingestion",
     "A CSV import for bank statements matched against pending bank-transfer donations, so the reconciliation "
     "an operator currently does by eye becomes a reviewed queue."),
]))

story.append(PageBreak())

# --- AREA B
story += [area_header("B", "Field operations and asset lifecycle",
                      "The system records what was delivered. The next step is managing what happens "
                      "to it over the following fifteen years."),
          Spacer(1, 8)]
story.append(points_table([
    ("Offline-first field capture",
     "Drilling sites have no reliable connectivity. A service worker with a local queue for readings, "
     "visit reports and photographs, syncing when the technician returns to signal, removes the paper step entirely."),
    ("Structured maintenance scheduling",
     "<font face='Courier'>nextVisitDue</font> computes a date; build the schedule around it — assignment to a "
     "technician, a route for the day, overdue escalation, and a calendar view in the admin."),
    ("Spare-parts and stock register",
     "Pumps, rising mains, seals and cylinders per water point, with consumption recorded against visits. "
     "Without it, the fault queue can diagnose but not resolve."),
    ("Water-quality test results as first-class data",
     "The register mentions certificates; model the underlying tests — parameter, value, threshold, laboratory, "
     "date — so a failed test becomes a fault and a passed one becomes public evidence."),
    ("Handover and community-committee records",
     "Who was trained, when, and which committee holds the point. This is the field that determines whether an "
     "asset survives, and funders increasingly ask for it."),
    ("Fault triage with severity and routing",
     "The queue is flat today. Add severity, automatic routing by district, an acknowledgement SLA distinct from "
     "the resolution SLA, and reminders to whoever is assigned."),
    ("Two-way SMS on the fault channel",
     "The QR sticker assumes a smartphone and a data connection. An SMS gateway with a short code and a "
     "structured reply reaches the far larger group that has neither."),
    ("Photographic evidence with integrity",
     "Require geotagged before/during/after photographs per visit, stored with a content hash, so a visit "
     "report cannot be assembled after the fact."),
    ("Drilling log and hydrogeology per borehole",
     "Depth intervals, strata, static water level, pumping test curve. This is the record that makes a second "
     "borehole in the same district cheaper, and it is currently lost."),
    ("Cost-per-point and unit economics",
     "Join spending entries to projects to produce cost per water point, per beneficiary and per litre per hour — "
     "the three figures every institutional funder asks for and that nobody can produce quickly."),
    ("Predictive failure signals",
     "With enough readings, flag points whose yield trend or fault frequency predicts failure, and surface them "
     "as a maintenance priority list rather than waiting for the fault report."),
    ("Field technician mobile role",
     "A fourth role, scoped to assigned projects and visits only, with a screen designed for a phone in sunlight — "
     "the permission model already supports adding one cleanly."),
]))

story.append(PageBreak())

# --- AREA C
story += [area_header("C", "Institutional partners and compliance",
                      "The portal exists and the partner report job runs. The gap is between what a "
                      "partner can see and what a funder's compliance officer is required to file."),
          Spacer(1, 8)]
story.append(points_table([
    ("Configurable report templates",
     "The partner report sends a fixed shape. Let each partner define which indicators, which period and which "
     "grouping they receive, because no two funders' templates agree."),
    ("Export in the funder's own format",
     "<font face='Courier'>/api/admin/export</font> produces one CSV shape. Add per-funder column mappings and an "
     "IATI-compatible export, so the operator stops retyping figures into a template."),
    ("Programme and grant objects",
     "A grant with a donor, a period, a budget, reporting obligations and a set of projects. Projects currently "
     "float free of the funding that paid for them, which makes attribution manual."),
    ("Budget versus actual per grant",
     "With grants modelled, spending entries can be allocated and variance reported — the single most requested "
     "figure in institutional reporting."),
    ("Document workflow beyond signature",
     "Signatures are bound to a content hash, which is the hard part. Add versioning, expiry, a countersignature "
     "step and reminders for documents left unsigned."),
    ("Partner-scoped analytics",
     "Give each partner the SLA figures, uptime and beneficiary counts for their own portfolio, with the same "
     "numbers the emailed report carries — so email and portal can never disagree."),
    ("Tender and prequalification pack",
     "The capability statement is generated from the delivery record. Extend it into a downloadable pack with "
     "certifications, insurances, equipment list and referee contacts, versioned and dated."),
    ("Quote-to-contract continuity",
     "<font face='Courier'>buildQuote</font> prices work and contracts exist separately. Connect them: accepted "
     "quote becomes a contract becomes projects, with the reference carried through."),
    ("Partner-initiated requests",
     "Let a partner raise a works request or report a fault from inside the portal, landing in the same queues "
     "staff already work, rather than by email."),
    ("Data-sharing agreements and licensing",
     "The open data endpoints state a licence in the payload. Formalise it: a licence page, attribution "
     "requirements, and per-partner terms recorded against their access."),
    ("Audit export for compliance review",
     "The audit log is visible in the admin. Make it exportable and filterable by actor, entity and period, "
     "which is what an external auditor actually asks for."),
    ("Multi-organisation tenancy for consortia",
     "<font face='Courier'>S3_PREFIX</font> already scopes storage per site. Extend the same thinking to the "
     "data model so a consortium can run one deployment with separated partner views."),
]))

story.append(PageBreak())

# --- AREA D
story += [area_header("D", "Content, discovery and AI visibility",
                      "This area is already unusually strong. The proposals below deepen an existing "
                      "advantage rather than repair a weakness."),
          Spacer(1, 8)]
story.append(points_table([
    ("Editorial workflow",
     "Draft, review, scheduled publication and rollback. Today an editor publishes directly; a review step is "
     "the difference between a blog and a communications function."),
    ("Translation status and machine-assisted drafts",
     "The editor shows which languages have content. Add a per-field translation status, a diff against the source "
     "language when it changes, and an optional machine first draft an editor corrects."),
    ("Luganda as a first-class locale",
     "Formatting currently falls back to English for dates and numbers. Ship proper formatting rules and review "
     "the messages file with a native speaker — it is the audience closest to the wells."),
    ("Structured answers as a content type",
     "The <font face='Courier'>answer</font> block already exists. Build a library of them, keyed to the questions "
     "funders and journalists actually ask, and expose them through the FAQ and llms endpoints."),
    ("Citation analytics",
     "Log which llms.txt, JSON and CSV endpoints are fetched and by which agents, so the open-data strategy can be "
     "measured rather than assumed."),
    ("Retrieval quality instrumentation",
     "The RAG assistant cites its sources. Record which chunks were retrieved and whether the answer was rated "
     "useful, then use that to tune chunking and thresholds."),
    ("Assistant escalation to a human",
     "When the assistant cannot answer from indexed content it should offer the enquiry form with the conversation "
     "attached, turning a dead end into a lead."),
    ("Multilingual embeddings",
     "One index serves five languages today. Evaluate a multilingual embedding model or per-locale indexes, because "
     "cross-language retrieval is where the current setup is weakest."),
    ("Rich media in the register",
     "Attach a short video and a photo essay to each water point and mark them up as structured data — the assets "
     "that travel furthest on social platforms are the ones that currently do not exist."),
    ("Newsletter as a real channel",
     "Subscribers are collected but nothing is sent to them. Composable campaigns from published content, "
     "per-locale, with unsubscribe handling and delivery statistics."),
    ("Print-quality outputs",
     "The capability page is designed to print. Extend the approach: a project one-pager, a campaign leaflet and an "
     "annual review, all generated from live data so they cannot drift."),
    ("Search that learns",
     "Log queries with zero results and surface them to editors as a content backlog — the cheapest content strategy "
     "there is, and the data is already passing through the search service."),
]))

story.append(PageBreak())

# --- AREA E
story += [area_header("E", "Platform, security and operations",
                      "The deployment is deliberately simple, and that is a virtue. These points remove "
                      "the specific ceilings that simplicity has created."),
          Spacer(1, 8)]
story.append(points_table([
    ("Password reset flow",
     "The <font face='Courier'>password_reset_tokens</font> table exists and nothing uses it. Today a locked-out "
     "administrator needs shell access to the container. This is the single most disproportionate gap in the system."),
    ("Two-factor authentication for staff",
     "TOTP for the admin and finance roles. The session layer is already a clean choke point, so the change is "
     "contained to sign-in and a user setting."),
    ("Shared-store rate limiting",
     "Rate limits are in-process, so they apply per replica. Moving them to Redis is the precondition for running "
     "more than one instance, and it is documented as such."),
    ("Session revocation and device list",
     "Signed JWTs cannot currently be invalidated before expiry. A revocation list, plus a visible session list per "
     "user, closes the gap left by a leaked cookie."),
    ("Structured logging and error tracking",
     "Errors go to the console. Structured logs with a request id, plus an error tracker, are what make an incident "
     "at 02:00 diagnosable rather than reconstructed."),
    ("Uptime and business-metric monitoring",
     "The health probe checks the database. Add checks for storage, mail and each payment provider, and alert on "
     "business signals — donations stopped, webhooks silent — not just process liveness."),
    ("Automated backup and restore rehearsal",
     "Everything but the media lives in PostgreSQL. Scheduled dumps, off-site retention, S3 prefix replication, and "
     "a restore actually tested on a schedule."),
    ("CI pipeline",
     "Typecheck, lint, unit and Playwright suites on every push, with the migration set applied against a throwaway "
     "database — the tests exist, the gate does not."),
    ("Test coverage where the money is",
     "Domain logic is well covered; the payment providers, webhook handling, Server Actions and portal flows are not. "
     "These are exactly the paths where a silent bug costs money or leaks data."),
    ("Background job runner",
     "Work is done inline or on a cron URL. A proper queue with retries and dead-lettering makes embedding indexing, "
     "mail and reconciliation observable and safely repeatable."),
    ("Media pipeline hardening",
     "Uploads are sniffed and bounded. Add virus scanning, a CDN in front of the bucket, and signed URLs for partner "
     "documents that should never be publicly addressable."),
    ("Configuration and secret management",
     "Nine feature gates are inferred from environment variables. A settings screen that shows each gate, tests the "
     "connection and explains what is missing turns deployment archaeology into a checklist."),
]))

story.append(PageBreak())

# ---------------------------------------------------------------- CLOSING
story += section("SECTION 7", "Sequencing")

story += [P("Not all sixty points are equal. If the list has to be reduced to a first quarter of "
            "work, the following ordering follows from the codebase rather than from preference.", "lead")]

story.append(table(
    ["Priority", "Points", "Reason"],
    [
        ["Immediate", "E1 password reset · E2 two-factor · E8 CI pipeline · E9 test coverage on payments",
         "These are gaps rather than features. A locked-out administrator currently needs container shell "
         "access, and the money paths are the least tested code in the repository"],
        ["First quarter", "A1 recurring giving · A2 donor accounts · A3 tax statements · B1 offline capture · "
                          "C1 configurable reports",
         "Each converts existing infrastructure into retained revenue or removes recurring manual work"],
        ["Second quarter", "B2 maintenance scheduling · B3 spare parts · C3 grant objects · C4 budget versus "
                           "actual · D1 editorial workflow",
         "Structural additions that the current data model accommodates without rework"],
        ["Enabling, in parallel", "E3 shared rate limiting · E5 structured logging · E6 monitoring · E10 job runner",
         "The prerequisites for running more than one replica; nothing above scales past a single instance without them"],
    ],
    [24 * mm, 62 * mm, CONTENT_W - 86 * mm],
    styles=["cellb", "codes", "cell"],
))

story += [Spacer(1, 10)]
story.append(callout(
    "One constraint to carry into all of it",
    "The property that makes this codebase pleasant to operate is that three environment variables boot it "
    "and every integration degrades to a working subset when absent. Every proposal above should be built "
    "as another feature gate — visible in the dashboard, off by default, and harmless when unconfigured. "
    "An expansion that makes the application require more to start would cost more than it adds.",
))

story += [Spacer(1, 14), rule(RULE), Spacer(1, 6),
          P("Prepared from commit <font face='Courier'>caa7bb8</font> of "
            "<font face='Courier'>Omega-Nodes-Company-LTD/drills-patrick</font>, branch "
            "<font face='Courier'>main</font>. Counts stated in this report (23 public page routes, 54 database "
            "tables, 19 block types, 58 exported Server Actions, 9 API routes) were taken from the source "
            "tree at that commit.", "small")]

# ================================================================== BUILD
doc = BaseDocTemplate(
    OUT, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
    title=DOC_TITLE, author="VEGA platform documentation", subject="Function inventory and expansion proposal",
)
frame = Frame(MARGIN, MARGIN, CONTENT_W, PAGE_H - 2 * MARGIN, id="f")
doc.addPageTemplates([
    PageTemplate(id="cover", frames=[frame], onPage=draw_cover),
    PageTemplate(id="body", frames=[frame], onPage=draw_page),
])
os.makedirs(os.path.dirname(OUT), exist_ok=True)
doc.build(story)
print("written", OUT)
