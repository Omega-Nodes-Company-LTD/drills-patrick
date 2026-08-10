import { relations } from 'drizzle-orm'
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { partners } from './crm'
import { media } from './media'
import { projects } from './projects'
import { id, localeEnum, timestamps } from './shared'

/**
 * The partner-facing side of the business.
 *
 * The public site persuades an NGO to get in touch; everything here is what
 * happens afterwards — the quote, the borehole log, the handover certificate,
 * the maintenance contract, the fault someone reports two years later. It is
 * kept apart from the editorial schema because none of it is content: it is
 * the record of work done for a named organisation, and it is the part a
 * donor's auditor asks to see.
 */

// ------------------------------------------------------------------ accounts

/**
 * A person at a partner organisation who can sign in to the partner area.
 *
 * Separate from `users`: an admin account carries permissions over the whole
 * site, and a partner contact must never be one row's `role` column away from
 * that. Different table, different session, no shared escalation path.
 */
export const ngoContacts = pgTable(
  'ngo_contacts',
  {
    id: id(),
    partnerId: uuid()
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    email: text().notNull().unique(),
    passwordHash: text().notNull(),
    name: text().notNull(),
    role: text(),
    phone: text(),
    locale: localeEnum().notNull().default('en'),
    isActive: boolean().notNull().default(true),
    /** Opt-in for the periodic project report. */
    reportFrequency: text().notNull().default('none').$type<'none' | 'monthly' | 'quarterly'>(),
    lastReportAt: timestamp({ withTimezone: true }),
    lastLoginAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [index('ngo_contacts_partner_idx').on(table.partnerId)],
)

/** Which projects a partner organisation may see in the portal. */
export const partnerProjects = pgTable(
  'partner_projects',
  {
    id: id(),
    partnerId: uuid()
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** Free text: "funder", "implementing partner", "district authority". */
    relationship: text().notNull().default('funder'),
    ...timestamps,
  },
  (table) => [unique('partner_projects_key').on(table.partnerId, table.projectId)],
)

// ----------------------------------------------------------------- documents

export const documentKindEnum = pgEnum('document_kind', [
  'water_quality',
  'drilling_log',
  'handover',
  'commissioning',
  'contract',
  'report',
  'other',
])

/**
 * A file attached to a project, visible to the partners linked to it.
 *
 * The file itself lives in the media library like everything else; this row
 * says what it is, which project it belongs to and whether the partner may
 * see it. Documents default to private: a water-quality certificate names a
 * village and a date, and publishing one by accident is not recoverable.
 */
export const projectDocuments = pgTable(
  'project_documents',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    mediaId: uuid().references(() => media.id, { onDelete: 'set null' }),
    kind: documentKindEnum().notNull().default('other'),
    title: text().notNull(),
    description: text(),
    /** Date the document itself carries, not the day it was uploaded. */
    issuedOn: date(),
    /** Certificates expire; the portal flags the ones that have. */
    expiresOn: date(),
    isPublic: boolean().notNull().default(false),
    uploadedById: uuid().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    index('project_documents_project_idx').on(table.projectId, table.kind),
    index('project_documents_public_idx').on(table.isPublic),
  ],
)

// ------------------------------------------------------------------- quoting

/**
 * Price list for the quote generator.
 *
 * Drilling is priced by depth band and by what the drill hits: soft overburden
 * and hard basement are different jobs at the same depth. Rates are rows, not
 * code, because they change with fuel and steel prices and the office must be
 * able to update them without a deployment.
 */
export const drillingRates = pgTable(
  'drilling_rates',
  {
    id: id(),
    label: text().notNull(),
    /** Inclusive lower bound, exclusive upper bound, in metres. */
    depthFromM: integer().notNull().default(0),
    depthToM: integer().notNull().default(1000),
    /** Free text matching the geology options offered in the form. */
    geology: text().notNull().default('any'),
    /** Minor units of `currency`, per metre. */
    ratePerMetreMinor: bigint({ mode: 'number' }).notNull().default(0),
    /** One-off charge: mobilisation, casing, pump, apron. */
    fixedCostMinor: bigint({ mode: 'number' }).notNull().default(0),
    currency: text().notNull().default('UGX'),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (table) => [index('drilling_rates_active_idx').on(table.isActive, table.sortOrder)],
)

/** A quote produced from the rate table, kept so it can be reissued. */
export const quotes = pgTable(
  'quotes',
  {
    id: id(),
    reference: text().notNull().unique(),
    partnerId: uuid().references(() => partners.id, { onDelete: 'set null' }),
    inquiryId: uuid(),
    organisationName: text().notNull(),
    contactName: text(),
    contactEmail: text(),
    district: text(),
    geology: text().notNull().default('any'),
    depthM: integer().notNull().default(60),
    wellsCount: integer().notNull().default(1),
    /** The computed breakdown, stored so an old quote never silently changes. */
    lines: jsonb()
      .$type<{ label: string; quantity: number; unitMinor: number; totalMinor: number }[]>()
      .notNull()
      .default([]),
    subtotalMinor: bigint({ mode: 'number' }).notNull().default(0),
    totalMinor: bigint({ mode: 'number' }).notNull().default(0),
    currency: text().notNull().default('UGX'),
    validUntil: date(),
    status: text().notNull().default('draft').$type<'draft' | 'sent' | 'accepted' | 'declined'>(),
    notes: text(),
    createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [index('quotes_partner_idx').on(table.partnerId, table.status)],
)

// --------------------------------------------------------------- maintenance

export const maintenanceContracts = pgTable(
  'maintenance_contracts',
  {
    id: id(),
    partnerId: uuid()
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    reference: text().notNull(),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    /** Months between scheduled visits; drives the due-date reminders. */
    visitIntervalMonths: integer().notNull().default(6),
    feeMinor: bigint({ mode: 'number' }).notNull().default(0),
    currency: text().notNull().default('UGX'),
    /** Hours promised for a first response, used by the SLA figures. */
    responseHours: integer().notNull().default(72),
    isActive: boolean().notNull().default(true),
    notes: text(),
    ...timestamps,
  },
  (table) => [index('maintenance_contracts_partner_idx').on(table.partnerId, table.isActive)],
)

/** Which water points a contract covers. */
export const contractProjects = pgTable(
  'contract_projects',
  {
    id: id(),
    contractId: uuid()
      .notNull()
      .references(() => maintenanceContracts.id, { onDelete: 'cascade' }),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
  },
  (table) => [unique('contract_projects_key').on(table.contractId, table.projectId)],
)

export const maintenanceVisitEnum = pgEnum('maintenance_visit_kind', [
  'scheduled',
  'repair',
  'inspection',
  'training',
])

/** What was actually done at a water point, and when. */
export const maintenanceVisits = pgTable(
  'maintenance_visits',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    contractId: uuid().references(() => maintenanceContracts.id, { onDelete: 'set null' }),
    faultReportId: uuid(),
    kind: maintenanceVisitEnum().notNull().default('scheduled'),
    visitedOn: date().notNull(),
    technician: text(),
    findings: text(),
    workDone: text(),
    partsUsed: text(),
    costMinor: bigint({ mode: 'number' }),
    currency: text().notNull().default('UGX'),
    /** Whether the water point was working when the team left. */
    functionalAfter: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [index('maintenance_visits_project_idx').on(table.projectId, table.visitedOn)],
)

// ------------------------------------------------------------ fault reports

export const faultStatusEnum = pgEnum('fault_status', [
  'reported',
  'acknowledged',
  'in_progress',
  'resolved',
  'closed',
])

/**
 * A fault reported from the field, usually by a villager with a phone.
 *
 * Anyone can file one — the QR sticker on the well cover leads straight to
 * the form, with no account and no app. The timestamps are what the SLA
 * figures are computed from, so they are columns rather than a status log.
 */
export const faultReports = pgTable(
  'fault_reports',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    reference: text().notNull().unique(),
    reporterName: text(),
    reporterPhone: text(),
    description: text().notNull(),
    /** Free text as the reporter chose it: "no water", "broken handle". */
    symptom: text(),
    status: faultStatusEnum().notNull().default('reported'),
    photoId: uuid().references(() => media.id, { onDelete: 'set null' }),
    acknowledgedAt: timestamp({ withTimezone: true }),
    resolvedAt: timestamp({ withTimezone: true }),
    resolutionNote: text(),
    ...timestamps,
  },
  (table) => [
    index('fault_reports_project_idx').on(table.projectId, table.status),
    index('fault_reports_status_idx').on(table.status, table.createdAt),
  ],
)

// ---------------------------------------------------------------- signatures

/**
 * A signature captured on a handover certificate.
 *
 * This is a witnessed record, not a qualified electronic signature: the
 * drawing, who signed, when, and a SHA-256 of the document contents at that
 * moment, so a later change to the document is detectable. Full legal
 * equivalence would need an eIDAS or comparable provider — see the PR that
 * introduced this.
 */
export const documentSignatures = pgTable(
  'document_signatures',
  {
    id: id(),
    documentId: uuid()
      .notNull()
      .references(() => projectDocuments.id, { onDelete: 'cascade' }),
    signerName: text().notNull(),
    signerRole: text(),
    signerOrganisation: text(),
    /** PNG data URL of the drawn signature. */
    signatureImage: text().notNull(),
    /** SHA-256 of the signed content, so tampering afterwards is visible. */
    contentHash: text().notNull(),
    signedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ipAddress: text(),
    ...timestamps,
  },
  (table) => [index('document_signatures_document_idx').on(table.documentId)],
)

// ----------------------------------------------------------------- relations

export const ngoContactsRelations = relations(ngoContacts, ({ one }) => ({
  partner: one(partners, { fields: [ngoContacts.partnerId], references: [partners.id] }),
}))

export const partnerProjectsRelations = relations(partnerProjects, ({ one }) => ({
  partner: one(partners, { fields: [partnerProjects.partnerId], references: [partners.id] }),
  project: one(projects, { fields: [partnerProjects.projectId], references: [projects.id] }),
}))

export const projectDocumentsRelations = relations(projectDocuments, ({ one, many }) => ({
  project: one(projects, { fields: [projectDocuments.projectId], references: [projects.id] }),
  file: one(media, { fields: [projectDocuments.mediaId], references: [media.id] }),
  signatures: many(documentSignatures),
}))

export const maintenanceContractsRelations = relations(maintenanceContracts, ({ one, many }) => ({
  partner: one(partners, { fields: [maintenanceContracts.partnerId], references: [partners.id] }),
  projects: many(contractProjects),
  visits: many(maintenanceVisits),
}))

export const maintenanceVisitsRelations = relations(maintenanceVisits, ({ one }) => ({
  project: one(projects, { fields: [maintenanceVisits.projectId], references: [projects.id] }),
  contract: one(maintenanceContracts, {
    fields: [maintenanceVisits.contractId],
    references: [maintenanceContracts.id],
  }),
}))

export const faultReportsRelations = relations(faultReports, ({ one }) => ({
  project: one(projects, { fields: [faultReports.projectId], references: [projects.id] }),
  photo: one(media, { fields: [faultReports.photoId], references: [media.id] }),
}))

export const documentSignaturesRelations = relations(documentSignatures, ({ one }) => ({
  document: one(projectDocuments, {
    fields: [documentSignatures.documentId],
    references: [projectDocuments.id],
  }),
}))

export type NgoContactRow = typeof ngoContacts.$inferSelect
export type ProjectDocumentRow = typeof projectDocuments.$inferSelect
export type DrillingRateRow = typeof drillingRates.$inferSelect
export type QuoteRow = typeof quotes.$inferSelect
export type MaintenanceContractRow = typeof maintenanceContracts.$inferSelect
export type MaintenanceVisitRow = typeof maintenanceVisits.$inferSelect
export type FaultReportRow = typeof faultReports.$inferSelect
export type DocumentSignatureRow = typeof documentSignatures.$inferSelect
