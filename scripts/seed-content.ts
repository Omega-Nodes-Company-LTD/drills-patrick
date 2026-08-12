/* eslint-disable no-console */
import 'dotenv/config'
import { eq, inArray, like, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../src/db/schema'
import { blocksSchema, type Block } from '../src/lib/blocks/schema'
import type { Locale } from '../src/i18n/config'

/**
 * Placeholder editorial content for VEGA, so the interface can be reviewed
 * before the real delivery records exist.
 *
 * Three rules shape everything below, because this runs against a site that is
 * already live and whose whole premise is that its figures are verifiable:
 *
 *  1. **Nothing invented reaches a public surface by default.** Projects, posts
 *     and campaigns are written as `draft`, and every public route — the open
 *     data feeds, the water point register, the impact badge partners paste on
 *     their own sites, the listings, the sitemap, the search index — filters on
 *     `published`. Pass `--publish` when the domain is not yet being shown to
 *     anyone and you want the populated site rendered end to end.
 *  2. **Everything is labelled and reversible.** Every public name carries
 *     `MARK`, every slug carries `SLUG_PREFIX`, and `--purge` removes exactly
 *     what this script created and nothing else.
 *  3. **Nothing already written is overwritten.** The three composed pages are
 *     skipped if they already carry blocks, so this can never eat work done in
 *     the admin. `--force` overrides that, deliberately.
 *
 * The copy is grounded in how this codebase actually works — quotes priced per
 * metre by depth band and geology, medians rather than means for response
 * times, faults reportable without an account — rather than invented. Figures
 * attached to individual water points are placeholders and marked as such.
 *
 * Usage:
 *   pnpm tsx scripts/seed-content.ts              # draft, labelled
 *   pnpm tsx scripts/seed-content.ts --publish    # visible on the live site
 *   pnpm tsx scripts/seed-content.ts --purge      # remove it all again
 *
 * After seeding with `--publish`, run `pnpm reindex` or search and the chat
 * assistant will not see any of it.
 */

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')

const client = postgres(url, { max: 1 })
const db = drizzle(client, { schema, casing: 'snake_case' })

/** Luganda is deliberately absent: its public UI strings are still incomplete. */
const LOCALES = ['en', 'fr', 'it', 'de'] as const satisfies readonly Locale[]
type L = (typeof LOCALES)[number]
type T = Record<L, string>

const COMPANY = 'VEGA'
/** Prefix on every public-facing name. Set to '' once real content replaces this. */
const MARK = '[DEMO] '
/** Prefix on every slug. `--purge` matches on it, so do not change it casually. */
const SLUG_PREFIX = 'demo-'

const argv = process.argv.slice(2)
const PUBLISH = argv.includes('--publish')
const PURGE = argv.includes('--purge')
const FORCE = argv.includes('--force')
/** Validate the page blocks and exit, without opening a connection. */
const CHECK = argv.includes('--check')

const status = PUBLISH ? ('published' as const) : ('draft' as const)
const publishedAt = PUBLISH ? new Date() : null

function t(values: T): Record<string, string> {
  return { ...values }
}

function slug(base: string): string {
  return `${SLUG_PREFIX}${base}`
}

// ---------------------------------------------------------------------------
// Purge
// ---------------------------------------------------------------------------

async function purge() {
  console.log('Removing placeholder content…')

  const projectIds = await db
    .select({ id: schema.projectTranslations.projectId })
    .from(schema.projectTranslations)
    .where(like(schema.projectTranslations.slug, `${SLUG_PREFIX}%`))

  const postIds = await db
    .select({ id: schema.postTranslations.postId })
    .from(schema.postTranslations)
    .where(like(schema.postTranslations.slug, `${SLUG_PREFIX}%`))

  const campaignIds = await db
    .select({ id: schema.campaignTranslations.campaignId })
    .from(schema.campaignTranslations)
    .where(like(schema.campaignTranslations.slug, `${SLUG_PREFIX}%`))

  const categoryIds = await db
    .select({ id: schema.categoryTranslations.categoryId })
    .from(schema.categoryTranslations)
    .where(like(schema.categoryTranslations.slug, `${SLUG_PREFIX}%`))

  const faqIds = await db
    .select({ id: schema.faqTranslations.faqId })
    .from(schema.faqTranslations)
    .where(like(schema.faqTranslations.question, `${MARK}%`))

  const unique = (rows: { id: string }[]) => [...new Set(rows.map((row) => row.id))]

  // Campaigns and posts first: both reference projects and categories.
  if (campaignIds.length)
    await db.delete(schema.campaigns).where(inArray(schema.campaigns.id, unique(campaignIds)))
  if (postIds.length) await db.delete(schema.posts).where(inArray(schema.posts.id, unique(postIds)))
  if (categoryIds.length)
    await db.delete(schema.categories).where(inArray(schema.categories.id, unique(categoryIds)))
  if (faqIds.length) await db.delete(schema.faqs).where(inArray(schema.faqs.id, unique(faqIds)))

  // Testimonials reference projects, so they go before them.
  await db.delete(schema.testimonials).where(like(schema.testimonials.authorName, `${MARK}%`))
  if (projectIds.length)
    await db.delete(schema.projects).where(inArray(schema.projects.id, unique(projectIds)))

  await db.delete(schema.teamMembers).where(like(schema.teamMembers.name, `${MARK}%`))
  await db.delete(schema.partners).where(like(schema.partners.name, `${MARK}%`))

  // Composed pages are emptied rather than deleted: routing depends on them.
  // Only the ones this script wrote are touched — identified by block id.
  const pages = await db
    .select({ id: schema.pages.id, key: schema.pages.key, blocks: schema.pages.blocks })
    .from(schema.pages)
    .where(inArray(schema.pages.key, ['home', 'about', 'contact']))

  for (const page of pages) {
    const isOurs = (page.blocks ?? []).every((block) => block.id?.startsWith(`${page.key}-`))
    if (!isOurs) {
      console.warn(`  ! page "${page.key}" has been edited since seeding — left alone`)
      continue
    }
    await db.update(schema.pages).set({ blocks: [] }).where(eq(schema.pages.id, page.id))
  }

  console.log('Placeholder content removed.')
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const CATEGORIES = [
  {
    base: 'field-notes',
    color: '#0a6d8f',
    name: { en: 'Field notes', fr: 'Notes de terrain', it: 'Note dal campo', de: 'Feldnotizen' },
    description: {
      en: 'What the drilling crews record on site.',
      fr: 'Ce que les équipes de forage consignent sur place.',
      it: 'Quello che le squadre di perforazione annotano sul posto.',
      de: 'Was die Bohrteams vor Ort festhalten.',
    },
  },
  {
    base: 'water-quality',
    color: '#2f8f6b',
    name: {
      en: 'Water quality',
      fr: "Qualité de l'eau",
      it: "Qualità dell'acqua",
      de: 'Wasserqualität',
    },
    description: {
      en: 'Testing, treatment, and what the results actually mean.',
      fr: 'Analyses, traitement et interprétation réelle des résultats.',
      it: "Analisi, trattamento e cosa significano davvero i risultati.",
      de: 'Analysen, Aufbereitung und was die Ergebnisse wirklich bedeuten.',
    },
  },
  {
    base: 'maintenance',
    color: '#a4632c',
    name: { en: 'Maintenance', fr: 'Maintenance', it: 'Manutenzione', de: 'Instandhaltung' },
    description: {
      en: 'Visit schedules, fault reports and what happens after handover.',
      fr: 'Calendriers de visite, signalements de panne et suites de la remise.',
      it: 'Calendari di visita, segnalazioni di guasto e cosa accade dopo la consegna.',
      de: 'Besuchspläne, Störungsmeldungen und was nach der Übergabe geschieht.',
    },
  },
] as const

async function seedCategories() {
  const ids: Record<string, string> = {}

  for (const [index, category] of CATEGORIES.entries()) {
    const [row] = await db
      .insert(schema.categories)
      .values({ color: category.color, sortOrder: index })
      .returning({ id: schema.categories.id })

    if (!row) continue
    ids[category.base] = row.id

    await db.insert(schema.categoryTranslations).values(
      LOCALES.map((locale) => ({
        categoryId: row.id,
        locale,
        name: `${MARK}${category.name[locale]}`,
        slug: slug(`${category.base}-${locale}`),
        description: category.description[locale],
      })),
    )
  }

  console.log(`  categories: ${Object.keys(ids).length}`)
  return ids
}

// ---------------------------------------------------------------------------
// Projects — the spine. Everything else references these.
// ---------------------------------------------------------------------------

type ProjectSeed = {
  base: string
  status: 'planned' | 'in_progress' | 'completed'
  type: 'borehole' | 'shallow_well' | 'spring_protection' | 'solar_pump' | 'rehabilitation'
  wells: number
  district: string
  region: string
  village: string
  lat: number
  lng: number
  depth: number | null
  yield: number | null
  quality: T | null
  beneficiaries: number
  households: number
  schools: number
  clinics: number
  preWalk: number
  postWalk: number
  preQueue: number
  postQueue: number
  budgetEur: number
  fundedEur: number
  start: string | null
  completion: string | null
  planned: string | null
  featured: boolean
  title: T
  summary: T
  body: T
}

const PROJECTS: ProjectSeed[] = [
  {
    base: 'kanyanda-borehole',
    status: 'completed',
    type: 'borehole',
    wells: 1,
    district: 'Nakaseke',
    region: 'Central',
    village: 'Kanyanda',
    lat: 0.7042,
    lng: 32.4231,
    depth: 62,
    yield: 2400,
    quality: {
      en: 'Bacteriological: nil coliforms. pH 6.9. Iron 0.2 mg/l. Tested at handover and again at the six-month visit.',
      fr: "Bactériologie : coliformes nuls. pH 6,9. Fer 0,2 mg/l. Analysé à la remise puis à la visite de six mois.",
      it: 'Batteriologica: coliformi assenti. pH 6,9. Ferro 0,2 mg/l. Analizzata alla consegna e alla visita dei sei mesi.',
      de: 'Bakteriologie: keine Coliformen. pH 6,9. Eisen 0,2 mg/l. Geprüft bei Übergabe und beim Sechs-Monats-Besuch.',
    },
    beneficiaries: 1180,
    households: 196,
    schools: 1,
    clinics: 0,
    preWalk: 75,
    postWalk: 8,
    preQueue: 55,
    postQueue: 12,
    budgetEur: 14500,
    fundedEur: 14500,
    start: '2025-02-10',
    completion: '2025-04-22',
    planned: '2025-04-30',
    featured: true,
    title: {
      en: 'Kanyanda village borehole',
      fr: 'Forage du village de Kanyanda',
      it: 'Pozzo del villaggio di Kanyanda',
      de: 'Bohrloch im Dorf Kanyanda',
    },
    summary: {
      en: 'A 62-metre borehole with a hand pump serving 196 households and the village primary school. Handed over April 2025.',
      fr: "Un forage de 62 mètres à pompe à main desservant 196 ménages et l'école primaire du village. Remis en avril 2025.",
      it: 'Un pozzo di 62 metri con pompa a mano al servizio di 196 famiglie e della scuola primaria. Consegnato ad aprile 2025.',
      de: 'Ein 62 Meter tiefes Bohrloch mit Handpumpe für 196 Haushalte und die Dorfgrundschule. Übergeben im April 2025.',
    },
    body: {
      en: '<h2>Before</h2><p>The community drew water from a seasonal stream, a seventy-five minute walk each way with a fifty-five minute wait at the source. In the dry season the stream failed entirely and households bought from a vendor.</p><h2>Siting</h2><p>A resistivity survey identified two candidate points. The district water officer approved the western one before any rig moved, which is the sequence we follow everywhere — the approval is part of the record, not a formality applied afterwards.</p><h2>What was built</h2><p>Drilled to 62 metres through overburden into weathered basement. Steel casing, gravel pack, six hours of development until the water ran clear, then an India Mark II hand pump on a concrete apron with a drainage channel.</p><h2>After</h2><p>Yield measured 2,400 litres per hour at completion, after development rather than during drilling. The walk is now eight minutes and the queue twelve. Nine committee members completed the two-day maintenance training and hold a signed handover certificate with the drilling log attached.</p>',
      fr: "<h2>Avant</h2><p>La communauté puisait dans un ruisseau saisonnier, à soixante-quinze minutes de marche aller, avec cinquante-cinq minutes d'attente à la source. En saison sèche, le ruisseau tarissait et les ménages achetaient à un revendeur.</p><h2>Implantation</h2><p>Une étude de résistivité a identifié deux points candidats. Le responsable de l'eau du district a validé celui de l'ouest avant tout déplacement de foreuse : cette approbation fait partie du dossier, ce n'est pas une formalité ajoutée après coup.</p><h2>Ce qui a été réalisé</h2><p>Foré à 62 mètres à travers les altérites jusqu'au socle altéré. Tubage acier, massif filtrant, six heures de développement jusqu'à eau claire, puis une pompe à main India Mark II sur une margelle bétonnée avec caniveau.</p><h2>Après</h2><p>Débit mesuré à 2 400 litres par heure à la réception, après développement et non pendant le forage. Le trajet est désormais de huit minutes et l'attente de douze. Neuf membres du comité ont suivi la formation de deux jours et détiennent un certificat de remise signé, rapport de forage en annexe.</p>",
      it: "<h2>Prima</h2><p>La comunità attingeva da un torrente stagionale, settantacinque minuti di cammino all'andata e cinquantacinque minuti di attesa alla fonte. Nella stagione secca il torrente si esauriva e le famiglie compravano da un rivenditore.</p><h2>Ubicazione</h2><p>Un'indagine di resistività ha individuato due punti candidati. Il responsabile idrico distrettuale ha approvato quello occidentale prima che si muovesse qualsiasi perforatrice: l'approvazione fa parte del registro, non è una formalità aggiunta dopo.</p><h2>Cosa è stato costruito</h2><p>Perforato a 62 metri attraverso la coltre alterata fino al basamento alterato. Rivestimento in acciaio, dreno di ghiaia, sei ore di spurgo fino ad acqua limpida, poi una pompa a mano India Mark II su platea in calcestruzzo con canaletta di drenaggio.</p><h2>Dopo</h2><p>Portata misurata in 2.400 litri l'ora al collaudo, dopo lo spurgo e non durante la perforazione. Il percorso è ora di otto minuti e la coda di dodici. Nove membri del comitato hanno completato la formazione di due giorni e detengono un certificato di consegna firmato con il rapporto di perforazione allegato.</p>",
      de: '<h2>Vorher</h2><p>Die Gemeinde holte Wasser aus einem saisonalen Bach — fünfundsiebzig Minuten Fußweg je Richtung, fünfundfünfzig Minuten Wartezeit an der Quelle. In der Trockenzeit versiegte der Bach vollständig und die Haushalte kauften bei einem Händler.</p><h2>Standortwahl</h2><p>Eine Widerstandsmessung ergab zwei mögliche Punkte. Die Wasserbehörde des Distrikts genehmigte den westlichen, bevor ein Bohrgerät bewegt wurde — diese Genehmigung ist Teil des Nachweises, keine nachgereichte Formalie.</p><h2>Was gebaut wurde</h2><p>Gebohrt auf 62 Meter durch das Deckgebirge bis in verwittertes Grundgebirge. Stahlverrohrung, Kiesschüttung, sechs Stunden Entwicklung bis klares Wasser, dann eine India-Mark-II-Handpumpe auf einer Betonschürze mit Ablaufrinne.</p><h2>Nachher</h2><p>Bei Abnahme 2.400 Liter pro Stunde gemessen — nach der Entwicklung, nicht während der Bohrung. Der Weg beträgt jetzt acht Minuten, die Wartezeit zwölf. Neun Komiteemitglieder absolvierten die zweitägige Schulung und halten ein unterzeichnetes Übergabezertifikat mit beigefügtem Bohrprotokoll.</p>',
    },
  },
  {
    base: 'bugoba-solar-pump',
    status: 'completed',
    type: 'solar_pump',
    wells: 1,
    district: 'Luwero',
    region: 'Central',
    village: 'Bugoba',
    lat: 0.8494,
    lng: 32.4735,
    depth: 78,
    yield: 5200,
    quality: {
      en: 'Bacteriological: nil coliforms. pH 7.1. Conductivity 410 µS/cm. Certificate published on the water point register.',
      fr: 'Bactériologie : coliformes nuls. pH 7,1. Conductivité 410 µS/cm. Certificat publié au registre des points d’eau.',
      it: "Batteriologica: coliformi assenti. pH 7,1. Conducibilità 410 µS/cm. Certificato pubblicato nel registro dei punti d'acqua.",
      de: 'Bakteriologie: keine Coliformen. pH 7,1. Leitfähigkeit 410 µS/cm. Zertifikat im Wasserstellenregister veröffentlicht.',
    },
    beneficiaries: 2650,
    households: 430,
    schools: 2,
    clinics: 1,
    preWalk: 55,
    postWalk: 6,
    preQueue: 70,
    postQueue: 9,
    budgetEur: 38900,
    fundedEur: 38900,
    start: '2025-05-06',
    completion: '2025-08-14',
    planned: '2025-08-31',
    featured: true,
    title: {
      en: 'Bugoba solar-pumped scheme',
      fr: 'Réseau solaire de Bugoba',
      it: 'Impianto solare di Bugoba',
      de: 'Solarbetriebenes System Bugoba',
    },
    summary: {
      en: 'Solar pump feeding a 10,000-litre elevated tank and four tap stands, one of them inside the health centre compound.',
      fr: "Pompe solaire alimentant un réservoir surélevé de 10 000 litres et quatre bornes-fontaines, dont une dans l'enceinte du centre de santé.",
      it: 'Pompa solare che alimenta un serbatoio sopraelevato da 10.000 litri e quattro punti di prelievo, uno nel recinto del centro sanitario.',
      de: 'Solarpumpe für einen 10.000-Liter-Hochtank und vier Zapfstellen, davon eine auf dem Gelände des Gesundheitszentrums.',
    },
    body: {
      en: '<h2>Why a scheme and not a pump</h2><p>A health centre needs water at the point of use, not two hundred metres away, and the trading centre around it had outgrown what one hand pump can deliver in a day. A single pump would have produced a queue rather than a service.</p><h2>What was built</h2><p>Sixteen panels drive a submersible pump into a six-metre tower carrying a 10,000-litre tank. Distribution from the tank is gravity-fed to four tap stands, so nothing downstream of the tank depends on the sun or on a moving part.</p><h2>Running it</h2><p>The committee collects a small tariff per jerrycan. Over the first year that has covered the maintenance contract without further subsidy, which is the test that matters — a scheme that needs an annual grant to stay running has not been handed over, it has been lent.</p>',
      fr: "<h2>Pourquoi un réseau et non une pompe</h2><p>Un centre de santé a besoin d'eau au point d'usage, pas à deux cents mètres, et le centre commercial alentour avait dépassé ce qu'une pompe à main peut fournir en une journée. Une pompe unique aurait produit une file d'attente, pas un service.</p><h2>Ce qui a été réalisé</h2><p>Seize panneaux alimentent une pompe immergée qui remplit un réservoir de 10 000 litres sur une tour de six mètres. La distribution se fait ensuite par gravité vers quatre bornes-fontaines : rien en aval du réservoir ne dépend du soleil ni d'une pièce mobile.</p><h2>L'exploitation</h2><p>Le comité perçoit un tarif modique par jerrican. Sur la première année, cela a couvert le contrat de maintenance sans subvention supplémentaire — c'est le test qui compte : un réseau qui exige une subvention annuelle pour fonctionner n'a pas été remis, il a été prêté.</p>",
      it: "<h2>Perché un impianto e non una pompa</h2><p>Un centro sanitario ha bisogno di acqua nel punto di utilizzo, non a duecento metri, e il centro commerciale attorno aveva superato ciò che una pompa a mano può erogare in un giorno. Una sola pompa avrebbe prodotto una coda, non un servizio.</p><h2>Cosa è stato costruito</h2><p>Sedici pannelli alimentano una pompa sommersa che riempie un serbatoio da 10.000 litri su una torre di sei metri. Dal serbatoio la distribuzione avviene per gravità verso quattro punti di prelievo: nulla a valle del serbatoio dipende dal sole o da un organo in movimento.</p><h2>La gestione</h2><p>Il comitato riscuote una piccola tariffa per tanica. Nel primo anno ha coperto il contratto di manutenzione senza ulteriori sussidi — ed è questa la prova che conta: un impianto che ha bisogno di un contributo annuale per restare in funzione non è stato consegnato, è stato prestato.</p>",
      de: '<h2>Warum ein System und keine Pumpe</h2><p>Ein Gesundheitszentrum braucht Wasser am Verbrauchsort, nicht zweihundert Meter entfernt, und das umliegende Handelszentrum war dem entwachsen, was eine Handpumpe an einem Tag liefert. Eine einzelne Pumpe hätte eine Warteschlange erzeugt, keinen Dienst.</p><h2>Was gebaut wurde</h2><p>Sechzehn Module treiben eine Tauchpumpe, die einen 10.000-Liter-Tank auf einem sechs Meter hohen Turm füllt. Vom Tank verteilt sich das Wasser im Freigefälle auf vier Zapfstellen — nichts unterhalb des Tanks hängt von der Sonne oder einem beweglichen Teil ab.</p><h2>Der Betrieb</h2><p>Das Komitee erhebt einen geringen Tarif je Kanister. Im ersten Jahr hat das den Wartungsvertrag ohne weitere Zuschüsse gedeckt — und das ist der entscheidende Test: Ein System, das jährliche Zuwendungen zum Weiterlaufen braucht, wurde nicht übergeben, sondern verliehen.</p>',
    },
  },
  {
    base: 'kitemu-rehabilitation',
    status: 'completed',
    type: 'rehabilitation',
    wells: 1,
    district: 'Mubende',
    region: 'Central',
    village: 'Kitemu',
    lat: 0.5573,
    lng: 31.3956,
    depth: 45,
    yield: 1600,
    quality: {
      en: 'Bacteriological: nil coliforms after disinfection. Iron 0.4 mg/l, above the previous reading and attributed to the corroded rising main now replaced.',
      fr: 'Bactériologie : coliformes nuls après désinfection. Fer 0,4 mg/l, au-dessus du relevé précédent, attribué à la colonne montante corrodée désormais remplacée.',
      it: 'Batteriologica: coliformi assenti dopo disinfezione. Ferro 0,4 mg/l, superiore alla lettura precedente, attribuito alla colonna montante corrosa ora sostituita.',
      de: 'Bakteriologie: nach Desinfektion keine Coliformen. Eisen 0,4 mg/l, über dem Vorwert, zurückgeführt auf die inzwischen ersetzte korrodierte Steigleitung.',
    },
    beneficiaries: 760,
    households: 121,
    schools: 1,
    clinics: 0,
    preWalk: 40,
    postWalk: 7,
    preQueue: 35,
    postQueue: 10,
    budgetEur: 4200,
    fundedEur: 4200,
    start: '2025-09-02',
    completion: '2025-09-19',
    planned: '2025-09-30',
    featured: false,
    title: {
      en: 'Kitemu pump rehabilitation',
      fr: 'Réhabilitation de la pompe de Kitemu',
      it: 'Riabilitazione della pompa di Kitemu',
      de: 'Instandsetzung der Pumpe Kitemu',
    },
    summary: {
      en: 'A borehole abandoned for three years, returned to service in seventeen days by replacing the rising main and pump head.',
      fr: 'Un forage abandonné depuis trois ans, remis en service en dix-sept jours par le remplacement de la colonne montante et de la tête de pompe.',
      it: 'Un pozzo abbandonato da tre anni, rimesso in servizio in diciassette giorni sostituendo la colonna montante e la testa della pompa.',
      de: 'Ein seit drei Jahren stillgelegtes Bohrloch, in siebzehn Tagen durch Austausch von Steigleitung und Pumpenkopf wieder in Betrieb.',
    },
    body: {
      en: '<h2>Check this first</h2><p>A broken borehole in the village is usually a better investment than a new one beside it. Rehabilitation costs roughly a quarter to a third of a new hand-pump borehole and takes weeks rather than months, and it is the first thing worth surveying.</p><h2>What had failed</h2><p>The borehole itself was sound — the log from the original contractor was still legible and the water level had not moved. The rising main had corroded through and the community had no route to a spare part, which is how a working water point becomes an abandoned one.</p><h2>What that says about spares</h2><p>The repair took seventeen days, eleven of which were waiting for parts. That waiting is the real failure, and it is why every handover now includes a named supplier and a parts list rather than only a trained committee.</p>',
      fr: "<h2>À vérifier en premier</h2><p>Un forage en panne au village est généralement un meilleur investissement qu'un forage neuf à côté. La réhabilitation coûte environ le quart au tiers d'un forage neuf à pompe à main et prend des semaines plutôt que des mois : c'est la première piste à étudier.</p><h2>Ce qui avait lâché</h2><p>L'ouvrage lui-même était sain — le rapport de l'entreprise d'origine restait lisible et le niveau d'eau n'avait pas bougé. La colonne montante était corrodée de part en part et la communauté n'avait aucun accès aux pièces détachées : c'est ainsi qu'un point d'eau en service devient un point d'eau abandonné.</p><h2>Ce que cela dit des pièces</h2><p>La réparation a pris dix-sept jours, dont onze d'attente de pièces. Cette attente est la vraie défaillance ; c'est pourquoi chaque remise comprend désormais un fournisseur nommé et une liste de pièces, et non seulement un comité formé.</p>",
      it: "<h2>Da verificare per primo</h2><p>Un pozzo guasto in villaggio è di solito un investimento migliore di uno nuovo accanto. La riabilitazione costa all'incirca da un quarto a un terzo di un nuovo pozzo con pompa a mano e richiede settimane anziché mesi: è la prima cosa da rilevare.</p><h2>Cosa aveva ceduto</h2><p>Il pozzo era integro — il rapporto dell'impresa originaria era ancora leggibile e il livello dell'acqua non si era spostato. La colonna montante era corrosa da parte a parte e la comunità non aveva modo di procurarsi un ricambio: è così che un punto d'acqua in funzione diventa un punto d'acqua abbandonato.</p><h2>Cosa dice sui ricambi</h2><p>L'intervento ha richiesto diciassette giorni, undici dei quali di attesa dei pezzi. Quell'attesa è il guasto vero, ed è il motivo per cui ogni consegna include ora un fornitore indicato per nome e una lista ricambi, non solo un comitato formato.</p>",
      de: '<h2>Das zuerst prüfen</h2><p>Ein defektes Bohrloch im Dorf ist meist die bessere Investition als ein neues daneben. Eine Instandsetzung kostet rund ein Viertel bis ein Drittel einer neuen Handpumpenbohrung und dauert Wochen statt Monate — sie gehört als Erstes erkundet.</p><h2>Was ausgefallen war</h2><p>Das Bohrloch selbst war intakt: Das Protokoll der ursprünglichen Firma war noch lesbar und der Wasserstand unverändert. Die Steigleitung war durchkorrodiert und die Gemeinde hatte keinen Zugang zu Ersatzteilen — so wird aus einer funktionierenden Wasserstelle eine aufgegebene.</p><h2>Was das über Ersatzteile sagt</h2><p>Die Reparatur dauerte siebzehn Tage, davon elf Wartezeit auf Teile. Diese Wartezeit ist der eigentliche Ausfall; deshalb gehört zu jeder Übergabe heute ein namentlich benannter Lieferant und eine Teileliste, nicht nur ein geschultes Komitee.</p>',
    },
  },
  {
    base: 'nabweru-spring',
    status: 'in_progress',
    type: 'spring_protection',
    wells: 1,
    district: 'Kayunga',
    region: 'Central',
    village: 'Nabweru',
    lat: 0.9847,
    lng: 32.8892,
    depth: null,
    yield: 900,
    quality: null,
    beneficiaries: 540,
    households: 88,
    schools: 0,
    clinics: 0,
    preWalk: 25,
    postWalk: 12,
    preQueue: 30,
    postQueue: 15,
    budgetEur: 3600,
    fundedEur: 2100,
    start: '2026-06-15',
    completion: null,
    planned: '2026-09-10',
    featured: false,
    title: {
      en: 'Nabweru spring protection',
      fr: 'Protection de la source de Nabweru',
      it: 'Protezione della sorgente di Nabweru',
      de: 'Quellfassung Nabweru',
    },
    summary: {
      en: 'Capping an existing spring so surface runoff stops contaminating it. Under construction, due September 2026.',
      fr: "Captage d'une source existante pour que le ruissellement cesse de la contaminer. En cours, échéance septembre 2026.",
      it: 'Captazione di una sorgente esistente perché il ruscellamento smetta di contaminarla. In corso, prevista per settembre 2026.',
      de: 'Fassung einer bestehenden Quelle, damit Oberflächenwasser sie nicht mehr verunreinigt. Im Bau, geplant für September 2026.',
    },
    body: {
      en: '<h2>The problem is not the water</h2><p>The spring already flows year round and the walk is only twenty-five minutes. The problem is what reaches it: cattle upslope and runoff after rain, which is why the households here report diarrhoea in the wet season and not the dry one.</p><h2>What protection means</h2><p>A masonry headwall and outlet pipe so water is collected before it touches the ground, a cut-off drain uphill of the eye to divert runoff, and a fenced exclusion zone.</p><h2>Cost per person</h2><p>This is the cheapest intervention we do per person served, and it is only available where a reliable spring already exists — which is why we survey for one before proposing a borehole.</p>',
      fr: "<h2>Le problème n'est pas l'eau</h2><p>La source coule déjà toute l'année et le trajet ne dure que vingt-cinq minutes. Le problème est ce qui l'atteint : du bétail en amont et le ruissellement après la pluie — d'où les diarrhées signalées ici en saison des pluies et non en saison sèche.</p><h2>Ce qu'implique la protection</h2><p>Un mur de captage en maçonnerie et un tuyau de sortie pour recueillir l'eau avant qu'elle ne touche le sol, un drain de dérivation en amont de l'émergence, et une zone clôturée d'exclusion.</p><h2>Coût par personne</h2><p>C'est l'intervention la moins coûteuse par personne desservie que nous réalisons, et elle n'est possible que là où une source fiable existe déjà — raison pour laquelle nous en cherchons une avant de proposer un forage.</p>",
      it: "<h2>Il problema non è l'acqua</h2><p>La sorgente scorre già tutto l'anno e il percorso dura solo venticinque minuti. Il problema è ciò che vi arriva: bestiame a monte e ruscellamento dopo la pioggia — ed è per questo che qui le famiglie segnalano diarrea nella stagione delle piogge e non in quella secca.</p><h2>Cosa significa proteggere</h2><p>Un muro di captazione in muratura e un tubo di uscita per raccogliere l'acqua prima che tocchi terra, un canale di guardia a monte della polla e un'area recintata di rispetto.</p><h2>Costo per persona</h2><p>È l'intervento con il costo per persona servita più basso che realizziamo, ed è possibile solo dove esiste già una sorgente affidabile — motivo per cui la cerchiamo prima di proporre un pozzo.</p>",
      de: '<h2>Das Problem ist nicht das Wasser</h2><p>Die Quelle schüttet bereits ganzjährig und der Weg dauert nur fünfundzwanzig Minuten. Das Problem ist, was sie erreicht: Vieh oberhalb und Abfluss nach Regen — deshalb melden die Haushalte hier Durchfall in der Regenzeit und nicht in der Trockenzeit.</p><h2>Was Schutz bedeutet</h2><p>Eine gemauerte Fassungswand mit Auslaufrohr, damit das Wasser gefasst wird, bevor es den Boden berührt, ein Abfanggraben oberhalb des Quellaustritts und eine eingezäunte Schutzzone.</p><h2>Kosten je Person</h2><p>Das ist die günstigste Maßnahme je versorgter Person in unserem Programm — und nur dort möglich, wo bereits eine verlässliche Quelle vorhanden ist. Deshalb suchen wir danach, bevor wir eine Bohrung vorschlagen.</p>',
    },
  },
  {
    base: 'namasagali-school',
    status: 'in_progress',
    type: 'borehole',
    wells: 1,
    district: 'Kamuli',
    region: 'Eastern',
    village: 'Namasagali',
    lat: 1.0114,
    lng: 33.0289,
    depth: 71,
    yield: null,
    quality: null,
    beneficiaries: 1420,
    households: 0,
    schools: 1,
    clinics: 0,
    preWalk: 50,
    postWalk: 4,
    preQueue: 65,
    postQueue: 14,
    budgetEur: 17800,
    fundedEur: 11200,
    start: '2026-07-01',
    completion: null,
    planned: '2026-10-15',
    featured: false,
    title: {
      en: 'Namasagali secondary school borehole',
      fr: 'Forage du lycée de Namasagali',
      it: 'Pozzo della scuola secondaria di Namasagali',
      de: 'Bohrloch der Sekundarschule Namasagali',
    },
    summary: {
      en: 'A borehole on school grounds for 1,320 boarding pupils and staff. Drilled to 71 m; pump installation and yield testing scheduled.',
      fr: "Un forage dans l'enceinte de l'école pour 1 320 internes et personnels. Foré à 71 m ; installation de la pompe et essai de débit programmés.",
      it: 'Un pozzo nel terreno della scuola per 1.320 convittori e personale. Perforato a 71 m; installazione pompa e prova di portata programmate.',
      de: 'Ein Bohrloch auf dem Schulgelände für 1.320 Internatsschüler und Beschäftigte. Auf 71 m gebohrt; Pumpeneinbau und Leistungstest terminiert.',
    },
    body: {
      en: '<h2>Why schools are different</h2><p>Boarding schools consume more water per head than villages, need it concentrated at three points in the day, and lose teaching hours when pupils fetch it. Sizing for a school is a different calculation from sizing for the same number of villagers.</p><h2>Progress</h2><p>Drilling reached 71 metres and struck a workable formation in fractured basement. Yield testing happens with the pump installation rather than being estimated from the drilling — a figure taken during drilling is not a yield.</p><h2>Who holds the contract</h2><p>The school will hold the maintenance contract directly rather than through a village committee. It has a budget line, a bursar and a lockable store, which a committee usually does not.</p>',
      fr: "<h2>Pourquoi les écoles diffèrent</h2><p>Les internats consomment plus d'eau par personne que les villages, en ont besoin de façon concentrée à trois moments de la journée, et perdent des heures de cours quand les élèves vont la chercher. Dimensionner pour une école n'est pas le même calcul que pour le même nombre de villageois.</p><h2>Avancement</h2><p>Le forage a atteint 71 mètres et rencontré une formation exploitable dans un socle fracturé. L'essai de débit se fera lors de l'installation de la pompe plutôt qu'estimé d'après le forage : un chiffre relevé pendant le forage n'est pas un débit.</p><h2>Qui détient le contrat</h2><p>L'école détiendra directement le contrat de maintenance, sans passer par un comité villageois. Elle dispose d'une ligne budgétaire, d'un intendant et d'un magasin fermant à clé — ce qu'un comité n'a généralement pas.</p>",
      it: "<h2>Perché le scuole sono diverse</h2><p>I convitti consumano più acqua pro capite dei villaggi, ne hanno bisogno concentrata in tre momenti della giornata e perdono ore di lezione quando sono gli alunni ad andare a prenderla. Dimensionare per una scuola è un calcolo diverso dal dimensionare per lo stesso numero di abitanti.</p><h2>Avanzamento</h2><p>La perforazione ha raggiunto i 71 metri incontrando una formazione sfruttabile in basamento fratturato. La prova di portata avverrà con l'installazione della pompa anziché essere stimata dalla perforazione: un valore rilevato durante la perforazione non è una portata.</p><h2>Chi detiene il contratto</h2><p>La scuola sarà titolare diretta del contratto di manutenzione, senza passare da un comitato di villaggio. Ha una voce di bilancio, un economo e un magazzino chiudibile a chiave — cosa che un comitato di norma non ha.</p>",
      de: '<h2>Warum Schulen anders sind</h2><p>Internate verbrauchen mehr Wasser pro Kopf als Dörfer, benötigen es konzentriert zu drei Tageszeiten und verlieren Unterrichtsstunden, wenn Schülerinnen und Schüler es holen. Die Auslegung für eine Schule ist eine andere Rechnung als für dieselbe Zahl Dorfbewohner.</p><h2>Stand</h2><p>Die Bohrung erreichte 71 Meter und traf im klüftigen Grundgebirge auf eine nutzbare Formation. Der Leistungstest erfolgt beim Pumpeneinbau, statt aus der Bohrung geschätzt zu werden — ein während des Bohrens abgelesener Wert ist keine Ergiebigkeit.</p><h2>Wer den Vertrag hält</h2><p>Die Schule hält den Wartungsvertrag direkt, nicht über ein Dorfkomitee. Sie hat einen Haushaltsposten, einen Verwalter und ein abschließbares Lager — was einem Komitee meist fehlt.</p>',
    },
  },
  {
    base: 'kalungi-shallow-wells',
    status: 'planned',
    type: 'shallow_well',
    wells: 3,
    district: 'Nakasongola',
    region: 'Central',
    village: 'Kalungi',
    lat: 1.3089,
    lng: 32.4471,
    depth: 18,
    yield: null,
    quality: null,
    beneficiaries: 890,
    households: 148,
    schools: 0,
    clinics: 1,
    preWalk: 60,
    postWalk: 10,
    preQueue: 45,
    postQueue: 12,
    budgetEur: 9400,
    fundedEur: 0,
    start: null,
    completion: null,
    planned: '2027-03-31',
    featured: false,
    title: {
      en: 'Kalungi shallow wells',
      fr: 'Puits peu profonds de Kalungi',
      it: 'Pozzi poco profondi di Kalungi',
      de: 'Flachbrunnen Kalungi',
    },
    summary: {
      en: 'Three lined hand-dug wells where the water table sits near the surface. Surveyed and costed; not yet funded.',
      fr: 'Trois puits maçonnés creusés à la main là où la nappe affleure. Étudiés et chiffrés ; financement non acquis.',
      it: 'Tre pozzi scavati a mano e rivestiti dove la falda è vicina alla superficie. Rilevati e preventivati; non ancora finanziati.',
      de: 'Drei ausgemauerte Handbrunnen dort, wo der Grundwasserspiegel nahe der Oberfläche liegt. Erhoben und kalkuliert; noch nicht finanziert.',
    },
    body: {
      en: '<h2>When a shallow well is the right answer</h2><p>Where the water table is within twenty metres and the overburden is stable, a lined hand-dug well costs a fraction of a drilled borehole and can be repaired with materials available in the district. Three wells here serve the same population one borehole would, at less than half the cost and with no imported spare parts.</p><h2>What is already done</h2><p>The survey is complete, the three sites are agreed with the sub-county, and the work is costed. Listed here as planned so the pipeline is visible rather than only the finished work.</p><h2>What is missing</h2><p>Funding. Work starts when it is confirmed; nothing is committed to the community before then.</p>',
      fr: "<h2>Quand un puits peu profond est la bonne réponse</h2><p>Là où la nappe est à moins de vingt mètres et où les altérites sont stables, un puits maçonné creusé à la main coûte une fraction d'un forage et se répare avec des matériaux disponibles dans le district. Trois puits desservent ici la même population qu'un forage, pour moins de la moitié du coût et sans pièce détachée importée.</p><h2>Ce qui est déjà fait</h2><p>L'étude est terminée, les trois sites sont validés avec la sous-préfecture et les travaux sont chiffrés. Inscrit ici comme planifié afin que le pipeline soit visible, et pas seulement les réalisations achevées.</p><h2>Ce qui manque</h2><p>Le financement. Les travaux démarrent dès qu'il est confirmé ; rien n'est promis à la communauté avant.</p>",
      it: "<h2>Quando un pozzo poco profondo è la risposta giusta</h2><p>Dove la falda è entro i venti metri e la coltre è stabile, un pozzo scavato a mano e rivestito costa una frazione di una perforazione e si ripara con materiali disponibili nel distretto. Tre pozzi qui servono la stessa popolazione di un pozzo profondo, a meno della metà del costo e senza ricambi importati.</p><h2>Cosa è già fatto</h2><p>Il rilievo è concluso, i tre siti sono concordati con la sotto-contea e i lavori sono preventivati. Elencato qui come pianificato perché sia visibile la pipeline e non solo il lavoro finito.</p><h2>Cosa manca</h2><p>Il finanziamento. I lavori partono a conferma; prima di allora nulla viene promesso alla comunità.</p>",
      de: '<h2>Wann ein Flachbrunnen die richtige Antwort ist</h2><p>Wo der Grundwasserspiegel innerhalb von zwanzig Metern liegt und das Deckgebirge standfest ist, kostet ein ausgemauerter Handbrunnen einen Bruchteil einer Bohrung und lässt sich mit im Distrikt verfügbarem Material reparieren. Drei Brunnen versorgen hier dieselbe Bevölkerung wie ein Bohrloch — zu weniger als der Hälfte der Kosten und ohne importierte Ersatzteile.</p><h2>Was bereits erledigt ist</h2><p>Die Erhebung ist abgeschlossen, die drei Standorte sind mit der Sub-County abgestimmt und die Arbeiten sind kalkuliert. Hier als geplant geführt, damit die Vorhabenliste sichtbar ist und nicht nur das Fertiggestellte.</p><h2>Was fehlt</h2><p>Die Finanzierung. Die Arbeiten beginnen nach Zusage; vorher wird der Gemeinde nichts versprochen.</p>',
    },
  },
]

const UPDATES: Record<string, { on: string; title: T; body: T }[]> = {
  'kanyanda-borehole': [
    {
      on: '2025-02-10',
      title: {
        en: 'Siting approved by the district',
        fr: 'Implantation approuvée par le district',
        it: 'Ubicazione approvata dal distretto',
        de: 'Standort vom Distrikt genehmigt',
      },
      body: {
        en: 'The resistivity survey identified two candidate points. The district water officer approved the western one; the eastern point sat too close to a latrine block.',
        fr: "L'étude de résistivité a identifié deux points candidats. Le responsable de l'eau du district a retenu celui de l'ouest ; le point est se trouvait trop près d'un bloc de latrines.",
        it: "L'indagine di resistività ha individuato due punti candidati. Il responsabile idrico distrettuale ha approvato quello occidentale; il punto orientale era troppo vicino a un blocco di latrine.",
        de: 'Die Widerstandsmessung ergab zwei mögliche Punkte. Die Distriktbehörde genehmigte den westlichen; der östliche lag zu nah an einem Latrinenblock.',
      },
    },
    {
      on: '2025-03-18',
      title: {
        en: 'Drilling completed at 62 m',
        fr: 'Forage terminé à 62 m',
        it: 'Perforazione conclusa a 62 m',
        de: 'Bohrung bei 62 m abgeschlossen',
      },
      body: {
        en: 'Overburden to 31 m, then weathered basement. Casing and gravel pack installed; development ran six hours until the water ran clear.',
        fr: "Altérites jusqu'à 31 m, puis socle altéré. Tubage et massif filtrant posés ; le développement a duré six heures jusqu'à eau claire.",
        it: 'Coltre alterata fino a 31 m, poi basamento alterato. Rivestimento e dreno di ghiaia installati; lo spurgo è durato sei ore fino ad acqua limpida.',
        de: 'Deckgebirge bis 31 m, dann verwittertes Grundgebirge. Verrohrung und Kiesschüttung eingebaut; die Entwicklung lief sechs Stunden bis klares Wasser.',
      },
    },
    {
      on: '2025-04-08',
      title: {
        en: 'Water test returned clear',
        fr: "Analyse d'eau conforme",
        it: "Analisi dell'acqua conforme",
        de: 'Wasseranalyse einwandfrei',
      },
      body: {
        en: 'Nil coliforms, pH 6.9, iron 0.2 mg/l. The certificate is published against this water point in the register.',
        fr: 'Coliformes nuls, pH 6,9, fer 0,2 mg/l. Le certificat est publié pour ce point d’eau dans le registre.',
        it: "Coliformi assenti, pH 6,9, ferro 0,2 mg/l. Il certificato è pubblicato per questo punto d'acqua nel registro.",
        de: 'Keine Coliformen, pH 6,9, Eisen 0,2 mg/l. Das Zertifikat ist zu dieser Wasserstelle im Register veröffentlicht.',
      },
    },
    {
      on: '2025-04-22',
      title: {
        en: 'Handed over to the village committee',
        fr: 'Remise au comité villageois',
        it: 'Consegna al comitato di villaggio',
        de: 'Übergabe an das Dorfkomitee',
      },
      body: {
        en: 'Nine members completed the two-day maintenance training. The handover certificate was signed on site, with the drilling log and water test attached.',
        fr: "Neuf membres ont suivi la formation de deux jours à l'entretien. Le certificat de remise a été signé sur place, rapport de forage et analyse d'eau en annexe.",
        it: "Nove membri hanno completato la formazione di due giorni alla manutenzione. Il certificato di consegna è stato firmato in loco, con rapporto di perforazione e analisi dell'acqua allegati.",
        de: 'Neun Mitglieder absolvierten die zweitägige Wartungsschulung. Das Übergabezertifikat wurde vor Ort unterzeichnet, mit Bohrprotokoll und Wasseranalyse im Anhang.',
      },
    },
  ],
  'bugoba-solar-pump': [
    {
      on: '2025-06-24',
      title: {
        en: 'Tank tower raised',
        fr: "Château d'eau érigé",
        it: 'Torre del serbatoio eretta',
        de: 'Tankturm errichtet',
      },
      body: {
        en: 'The six-metre tower and 10,000-litre tank were assembled on site over four days, ahead of the panel array.',
        fr: 'La tour de six mètres et le réservoir de 10 000 litres ont été assemblés sur place en quatre jours, avant le champ de panneaux.',
        it: 'La torre di sei metri e il serbatoio da 10.000 litri sono stati montati in loco in quattro giorni, prima del campo fotovoltaico.',
        de: 'Der sechs Meter hohe Turm und der 10.000-Liter-Tank wurden in vier Tagen vor Ort montiert, vor dem Modulfeld.',
      },
    },
    {
      on: '2025-08-14',
      title: {
        en: 'Four tap stands commissioned',
        fr: 'Quatre bornes-fontaines mises en service',
        it: 'Quattro punti di prelievo collaudati',
        de: 'Vier Zapfstellen in Betrieb genommen',
      },
      body: {
        en: 'Including one inside the health centre compound, which until now carried water by hand from the trading centre.',
        fr: "Dont une dans l'enceinte du centre de santé, qui transportait jusqu'ici l'eau à la main depuis le centre commercial.",
        it: "Tra cui uno nel recinto del centro sanitario, che finora portava l'acqua a mano dal centro commerciale.",
        de: 'Darunter eine auf dem Gelände des Gesundheitszentrums, das sein Wasser bislang per Hand aus dem Handelszentrum holte.',
      },
    },
  ],
  'namasagali-school': [
    {
      on: '2026-07-19',
      title: {
        en: 'Drilled to 71 m',
        fr: 'Foré à 71 m',
        it: 'Perforato a 71 m',
        de: 'Auf 71 m gebohrt',
      },
      body: {
        en: 'Fractured basement struck at 58 m. Casing installed; pump installation and yield testing scheduled for the following month.',
        fr: 'Socle fracturé rencontré à 58 m. Tubage posé ; installation de la pompe et essai de débit programmés le mois suivant.',
        it: 'Basamento fratturato incontrato a 58 m. Rivestimento installato; installazione pompa e prova di portata previste il mese successivo.',
        de: 'Klüftiges Grundgebirge bei 58 m angetroffen. Verrohrung eingebaut; Pumpeneinbau und Leistungstest für den Folgemonat terminiert.',
      },
    },
  ],
}

async function seedProjects() {
  const ids: Record<string, string> = {}

  for (const [index, project] of PROJECTS.entries()) {
    const [row] = await db
      .insert(schema.projects)
      .values({
        status: project.status,
        publishStatus: status,
        isFeatured: project.featured,
        waterPointType: project.type,
        country: 'Uganda',
        region: project.region,
        district: project.district,
        village: project.village,
        latitude: project.lat,
        longitude: project.lng,
        wellsCount: project.wells,
        depthMeters: project.depth,
        yieldLitersPerHour: project.yield,
        waterQualityNote: project.quality?.en ?? null,
        preWalkMinutes: project.preWalk,
        postWalkMinutes: project.postWalk,
        preQueueMinutes: project.preQueue,
        postQueueMinutes: project.postQueue,
        beneficiaries: project.beneficiaries,
        households: project.households || null,
        schoolsServed: project.schools || null,
        healthFacilitiesServed: project.clinics || null,
        startDate: project.start,
        completionDate: project.completion,
        plannedCompletionDate: project.planned,
        budgetAmount: project.budgetEur * 100,
        fundedAmount: project.fundedEur * 100,
        currency: 'EUR',
        sortOrder: index,
        publishedAt,
      })
      .returning({ id: schema.projects.id })

    if (!row) continue
    ids[project.base] = row.id

    await db.insert(schema.projectTranslations).values(
      LOCALES.map((locale) => ({
        projectId: row.id,
        locale,
        title: `${MARK}${project.title[locale]}`,
        slug: slug(`${project.base}-${locale}`),
        summary: project.summary[locale],
        contentHtml: project.body[locale],
        seoTitle: `${MARK}${project.title[locale]}`,
        seoDescription: project.summary[locale].slice(0, 160),
      })),
    )

    for (const [order, update] of (UPDATES[project.base] ?? []).entries()) {
      const [entry] = await db
        .insert(schema.projectUpdates)
        .values({
          projectId: row.id,
          happenedOn: update.on,
          sortOrder: order,
          isPublished: PUBLISH,
        })
        .returning({ id: schema.projectUpdates.id })

      if (!entry) continue

      await db.insert(schema.projectUpdateTranslations).values(
        LOCALES.map((locale) => ({
          updateId: entry.id,
          locale,
          title: update.title[locale],
          body: update.body[locale],
        })),
      )
    }
  }

  console.log(`  projects: ${Object.keys(ids).length} (${status})`)
  return ids
}

// ---------------------------------------------------------------------------
// People, partners and voices
// ---------------------------------------------------------------------------

const TEAM = [
  {
    name: 'Patrick Ssebunya',
    credentials: 'BSc Civil Engineering, Makerere University',
    role: {
      en: 'Founder and drilling supervisor',
      fr: 'Fondateur et superviseur de forage',
      it: 'Fondatore e responsabile delle perforazioni',
      de: 'Gründer und Bohrleiter',
    },
    bio: {
      en: 'Nineteen years on rigs across central and eastern Uganda. Signs off every siting decision before a rig is mobilised.',
      fr: "Dix-neuf ans sur les foreuses du centre et de l'est de l'Ouganda. Valide chaque implantation avant toute mobilisation.",
      it: "Diciannove anni sulle perforatrici nell'Uganda centrale e orientale. Approva ogni ubicazione prima della mobilitazione.",
      de: 'Neunzehn Jahre auf Bohrgeräten in Zentral- und Ostuganda. Zeichnet jede Standortwahl ab, bevor ein Gerät mobilisiert wird.',
    },
  },
  {
    name: 'Grace Nabukenya',
    credentials: 'MSc Hydrogeology',
    role: { en: 'Hydrogeologist', fr: 'Hydrogéologue', it: 'Idrogeologa', de: 'Hydrogeologin' },
    bio: {
      en: 'Runs the resistivity surveys and interprets the profiles that decide where a rig goes and what depth band a quote is priced against.',
      fr: "Réalise les études de résistivité et interprète les profils qui déterminent l'emplacement de la foreuse et la fourchette de profondeur du devis.",
      it: "Esegue le indagini di resistività e interpreta i profili che decidono dove va la perforatrice e su quale fascia di profondità si calcola il preventivo.",
      de: 'Führt die Widerstandsmessungen durch und deutet die Profile, die Bohrstandort und das Tiefenband der Kalkulation bestimmen.',
    },
  },
  {
    name: 'Joseph Okello',
    credentials: 'Diploma in Water Engineering',
    role: {
      en: 'Maintenance lead',
      fr: 'Responsable maintenance',
      it: 'Responsabile manutenzione',
      de: 'Leiter Instandhaltung',
    },
    bio: {
      en: 'Holds the visit schedule and the fault queue, and runs the two-day committee training at every handover.',
      fr: "Gère le calendrier des visites et la file des signalements, et anime la formation de deux jours du comité à chaque remise.",
      it: 'Gestisce il calendario delle visite e la coda dei guasti, e conduce la formazione di due giorni del comitato a ogni consegna.',
      de: 'Verantwortet Besuchsplan und Störungsliste und leitet bei jeder Übergabe die zweitägige Komiteeschulung.',
    },
  },
] as const

const PARTNERS = [
  { name: 'Sample Water Foundation', tier: 'foundation', url: 'https://example.org' },
  { name: 'Example Relief International', tier: 'ngo', url: 'https://example.org' },
  { name: 'Placeholder District Water Office', tier: 'government', url: null },
] as const

const TESTIMONIALS = [
  {
    author: 'Sarah Namuli',
    organisation: 'Example Relief International',
    project: 'kanyanda-borehole',
    role: {
      en: 'Programme Manager',
      fr: 'Responsable de programme',
      it: 'Responsabile di programma',
      de: 'Programmleiterin',
    },
    quote: {
      en: 'The drilling log and the water test arrived with the invoice, without being asked for. That is not how it usually goes.',
      fr: "Le rapport de forage et l'analyse d'eau sont arrivés avec la facture, sans qu'on les demande. Ce n'est pas l'usage.",
      it: "Il rapporto di perforazione e l'analisi dell'acqua sono arrivati con la fattura, senza chiederli. Non è la norma.",
      de: 'Bohrprotokoll und Wasseranalyse kamen unaufgefordert mit der Rechnung. Das ist sonst nicht üblich.',
    },
  },
  {
    author: 'David Kizza',
    organisation: 'Kanyanda water committee',
    project: 'kanyanda-borehole',
    role: {
      en: 'Committee chair',
      fr: 'Président du comité',
      it: 'Presidente del comitato',
      de: 'Komiteevorsitzender',
    },
    quote: {
      en: 'The training was two days and we have fixed the pump ourselves twice since. We only called once, and they came.',
      fr: "La formation a duré deux jours et nous avons réparé la pompe nous-mêmes deux fois depuis. Nous n'avons appelé qu'une fois, et ils sont venus.",
      it: 'La formazione è durata due giorni e da allora abbiamo riparato la pompa da soli due volte. Abbiamo chiamato una volta sola, e sono venuti.',
      de: 'Die Schulung dauerte zwei Tage, seither haben wir die Pumpe zweimal selbst repariert. Wir haben einmal angerufen — sie kamen.',
    },
  },
  {
    author: 'Miriam Achieng',
    organisation: 'Sample Water Foundation',
    project: 'bugoba-solar-pump',
    role: {
      en: 'Grants Officer',
      fr: 'Chargée de subventions',
      it: 'Referente per i finanziamenti',
      de: 'Fördermittelreferentin',
    },
    quote: {
      en: 'I exported the project data straight into our grant report. It saved a week of retyping figures out of PDFs.',
      fr: "J'ai exporté les données du projet directement dans notre rapport de subvention. Une semaine de ressaisie de chiffres depuis des PDF économisée.",
      it: 'Ho esportato i dati del progetto direttamente nel nostro rendiconto. Una settimana di ricopiatura di cifre dai PDF risparmiata.',
      de: 'Ich habe die Projektdaten direkt in unseren Förderbericht exportiert. Das hat eine Woche Abtippen von Zahlen aus PDFs gespart.',
    },
  },
] as const

const FAQS = [
  {
    category: 'general',
    question: {
      en: 'How long does a borehole take from agreement to handover?',
      fr: "Combien de temps entre l'accord et la remise d'un forage ?",
      it: "Quanto tempo passa dall'accordo alla consegna di un pozzo?",
      de: 'Wie lange dauert es von der Vereinbarung bis zur Übergabe?',
    },
    answer: {
      en: '<p>Typically ten to fourteen weeks. The resistivity survey and district approval take three to four, drilling and installation two to three, and the remainder is water testing, the two-day committee training and the handover itself.</p><p>Rehabilitating an existing borehole is faster — usually two to four weeks, most of it waiting for parts.</p>',
      fr: "<p>En général dix à quatorze semaines. L'étude de résistivité et l'accord du district prennent trois à quatre semaines, le forage et l'installation deux à trois, le reste étant les analyses d'eau, la formation de deux jours du comité et la remise.</p><p>Réhabiliter un forage existant est plus rapide : deux à quatre semaines, dont l'essentiel en attente de pièces.</p>",
      it: "<p>In genere da dieci a quattordici settimane. Indagine di resistività e approvazione distrettuale richiedono tre o quattro settimane, perforazione e installazione due o tre; il resto sono analisi dell'acqua, i due giorni di formazione del comitato e la consegna.</p><p>Riabilitare un pozzo esistente è più rapido: due-quattro settimane, in gran parte di attesa dei ricambi.</p>",
      de: '<p>In der Regel zehn bis vierzehn Wochen. Widerstandsmessung und Distriktgenehmigung dauern drei bis vier, Bohrung und Einbau zwei bis drei Wochen; der Rest entfällt auf Wasseranalysen, die zweitägige Komiteeschulung und die Übergabe.</p><p>Die Instandsetzung eines vorhandenen Bohrlochs geht schneller — meist zwei bis vier Wochen, überwiegend Wartezeit auf Teile.</p>',
    },
  },
  {
    category: 'general',
    question: {
      en: 'What happens if the pump breaks?',
      fr: 'Que se passe-t-il si la pompe tombe en panne ?',
      it: 'Cosa succede se la pompa si guasta?',
      de: 'Was passiert, wenn die Pumpe ausfällt?',
    },
    answer: {
      en: '<p>Anyone can report a fault from the water point’s own page — no account, no login, and a reference number comes back immediately so it can be quoted over the phone.</p><p>A water point that has stopped working is worse than one that was never built, because the community has already walked away from its old source. That is why response times are published rather than promised.</p>',
      fr: "<p>N'importe qui peut signaler une panne depuis la page du point d'eau — sans compte ni connexion, avec un numéro de référence renvoyé immédiatement, citable au téléphone.</p><p>Un point d'eau à l'arrêt est pire qu'un point d'eau jamais construit, car la communauté a déjà abandonné son ancienne source. C'est pourquoi les délais d'intervention sont publiés et non promis.</p>",
      it: "<p>Chiunque può segnalare un guasto dalla pagina del punto d'acqua — senza account né login, e con un numero di riferimento restituito subito, citabile al telefono.</p><p>Un punto d'acqua fermo è peggio di uno mai costruito, perché la comunità ha già abbandonato la fonte precedente. Per questo i tempi di intervento sono pubblicati, non promessi.</p>",
      de: '<p>Jede und jeder kann eine Störung direkt auf der Seite der Wasserstelle melden — ohne Konto, ohne Anmeldung, mit sofortiger Referenznummer, die sich am Telefon nennen lässt.</p><p>Eine stillstehende Wasserstelle ist schlimmer als eine nie gebaute, weil die Gemeinde ihre alte Quelle bereits aufgegeben hat. Deshalb werden Reaktionszeiten veröffentlicht statt versprochen.</p>',
    },
  },
  {
    category: 'general',
    question: {
      en: 'How is a borehole priced?',
      fr: 'Comment un forage est-il chiffré ?',
      it: 'Come si calcola il prezzo di un pozzo?',
      de: 'Wie wird ein Bohrloch kalkuliert?',
    },
    answer: {
      en: '<p>Per metre, by depth band and by geology — not as a single price per borehole. Soft overburden and hard basement at the same depth are different jobs, and the metres are billed band by band: the shallow band at its rate, the deeper metres at theirs.</p><p>On top of the metres sit the one-off items that do not scale with depth at all — mobilisation, casing, pump and apron. A quote from us shows those lines separately, so a variation later can be checked against the original rather than argued about.</p>',
      fr: "<p>Au mètre, par fourchette de profondeur et par géologie — et non à un prix unique par forage. Altérites tendres et socle dur à la même profondeur sont deux chantiers différents, et les mètres sont facturés par tranche : la tranche superficielle à son tarif, les mètres plus profonds au leur.</p><p>S'y ajoutent les postes forfaitaires, indépendants de la profondeur : mobilisation, tubage, pompe et margelle. Nos devis détaillent ces lignes séparément, de sorte qu'un avenant ultérieur se vérifie sur l'original au lieu de se discuter.</p>",
      it: "<p>Al metro, per fascia di profondità e per geologia — non a prezzo unico per pozzo. Coltre tenera e basamento duro alla stessa profondità sono lavori diversi, e i metri si fatturano fascia per fascia: quella superficiale alla sua tariffa, i metri più profondi alla loro.</p><p>Sopra i metri stanno le voci una tantum, indipendenti dalla profondità: mobilitazione, rivestimento, pompa e platea. I nostri preventivi mostrano quelle righe separatamente, così una variante successiva si verifica sull'originale invece di discuterla.</p>",
      de: '<p>Pro Meter, nach Tiefenband und Geologie — nicht als Pauschalpreis je Bohrloch. Weiches Deckgebirge und hartes Grundgebirge sind in gleicher Tiefe verschiedene Arbeiten, und die Meter werden bandweise abgerechnet: das flache Band zu seinem Satz, die tieferen Meter zu ihrem.</p><p>Hinzu kommen die einmaligen Posten, die gar nicht mit der Tiefe skalieren — Mobilisierung, Verrohrung, Pumpe und Brunnenschürze. Unsere Angebote weisen diese Zeilen getrennt aus, sodass sich ein späterer Nachtrag am Original prüfen statt bestreiten lässt.</p>',
    },
  },
  {
    category: 'ngo',
    question: {
      en: 'Can we see our own projects without asking for a report?',
      fr: 'Pouvons-nous consulter nos projets sans demander de rapport ?',
      it: 'Possiamo vedere i nostri progetti senza chiedere un rapporto?',
      de: 'Können wir unsere Projekte ohne Berichtsanforderung einsehen?',
    },
    answer: {
      en: '<p>Yes. Partner organisations get a sign-in to a portal showing only their own water points, documents, contracts and fault history — with an optional monthly or quarterly email summary carrying the same figures the portal shows, so the email and the site can never disagree.</p>',
      fr: "<p>Oui. Les organisations partenaires disposent d'un accès à un portail n'affichant que leurs propres points d'eau, documents, contrats et historique de pannes — avec, en option, un résumé mensuel ou trimestriel par e-mail reprenant les chiffres du portail, de sorte que l'e-mail et le site ne peuvent jamais diverger.</p>",
      it: "<p>Sì. Le organizzazioni partner ricevono un accesso a un portale che mostra solo i propri punti d'acqua, documenti, contratti e storico dei guasti — con un riepilogo mensile o trimestrale via e-mail facoltativo, che riporta le stesse cifre del portale: e-mail e sito non possono mai discordare.</p>",
      de: '<p>Ja. Partnerorganisationen erhalten einen Portalzugang, der ausschließlich ihre eigenen Wasserstellen, Dokumente, Verträge und Störungshistorie zeigt — auf Wunsch mit monatlicher oder vierteljährlicher E-Mail-Zusammenfassung, die dieselben Zahlen trägt wie das Portal. E-Mail und Website können so nie auseinanderlaufen.</p>',
    },
  },
  {
    category: 'ngo',
    question: {
      en: 'In what format do you provide project data for grant reporting?',
      fr: 'Sous quel format fournissez-vous les données pour les rapports de subvention ?',
      it: 'In quale formato fornite i dati per la rendicontazione?',
      de: 'In welchem Format liefern Sie Daten für die Förderberichterstattung?',
    },
    answer: {
      en: '<p>CSV, with the columns funders actually ask for: identifier, location down to district, dates, budget and currency, beneficiaries disaggregated as far as the data allows, and a machine-readable status rather than prose.</p><p>A CSV rather than a bespoke format, because it opens in the spreadsheet the officer already has and every donor portal accepts one.</p>',
      fr: "<p>En CSV, avec les colonnes que les bailleurs demandent réellement : identifiant, localisation jusqu'au district, dates, budget et devise, bénéficiaires désagrégés autant que les données le permettent, et un statut lisible par machine plutôt qu'en toutes lettres.</p><p>Un CSV plutôt qu'un format sur mesure : il s'ouvre dans le tableur que le chargé de programme utilise déjà et tous les portails de bailleurs l'acceptent.</p>",
      it: "<p>In CSV, con le colonne che i finanziatori chiedono davvero: identificativo, localizzazione fino al distretto, date, budget e valuta, beneficiari disaggregati per quanto i dati lo consentano e uno stato leggibile da una macchina anziché in prosa.</p><p>Un CSV anziché un formato su misura: si apre nel foglio di calcolo che il referente già usa e ogni portale dei donatori lo accetta.</p>",
      de: '<p>Als CSV, mit den Spalten, die Geldgeber tatsächlich verlangen: Kennung, Verortung bis zum Distrikt, Termine, Budget und Währung, Begünstigte so weit aufgeschlüsselt, wie die Daten es zulassen, und ein maschinenlesbarer Status statt Fließtext.</p><p>Eine CSV statt eines Sonderformats: Sie öffnet sich in der Tabellenkalkulation, die das Programmbüro ohnehin nutzt, und jedes Geberportal akzeptiert sie.</p>',
    },
  },
  {
    category: 'technical',
    question: {
      en: 'How is the depth of a borehole decided?',
      fr: "Comment la profondeur d'un forage est-elle décidée ?",
      it: 'Come si stabilisce la profondità di un pozzo?',
      de: 'Wie wird die Tiefe eines Bohrlochs bestimmt?',
    },
    answer: {
      en: '<p>By the geology, not by the budget. A resistivity survey gives a depth band before drilling starts and the quote is priced against that band. Where the formation turns out deeper, the variation is agreed before work continues rather than presented afterwards.</p>',
      fr: "<p>Par la géologie, pas par le budget. Une étude de résistivité donne une fourchette de profondeur avant le début du forage et le devis est chiffré sur cette fourchette. Si la formation s'avère plus profonde, l'avenant est validé avant la poursuite des travaux, et non présenté après coup.</p>",
      it: "<p>Dalla geologia, non dal budget. Un'indagine di resistività fornisce una fascia di profondità prima di iniziare e il preventivo è calcolato su quella fascia. Se la formazione risulta più profonda, la variante è concordata prima di proseguire, non presentata dopo.</p>",
      de: '<p>Durch die Geologie, nicht durch das Budget. Eine Widerstandsmessung liefert vor Bohrbeginn ein Tiefenband, und das Angebot wird darauf kalkuliert. Erweist sich die Formation als tiefer, wird der Nachtrag vor Fortsetzung der Arbeiten vereinbart — nicht hinterher vorgelegt.</p>',
    },
  },
] as const

async function seedPeople(projectIds: Record<string, string>) {
  for (const [index, member] of TEAM.entries()) {
    const [row] = await db
      .insert(schema.teamMembers)
      .values({
        name: `${MARK}${member.name}`,
        credentials: member.credentials,
        isPublished: PUBLISH,
        sortOrder: index,
      })
      .returning({ id: schema.teamMembers.id })

    if (!row) continue
    await db.insert(schema.teamMemberTranslations).values(
      LOCALES.map((locale) => ({
        memberId: row.id,
        locale,
        role: member.role[locale],
        bio: member.bio[locale],
      })),
    )
  }

  const partnerIds: string[] = []
  for (const [index, partner] of PARTNERS.entries()) {
    const [row] = await db
      .insert(schema.partners)
      .values({
        name: `${MARK}${partner.name}`,
        websiteUrl: partner.url,
        tier: partner.tier,
        isPublished: PUBLISH,
        sortOrder: index,
      })
      .returning({ id: schema.partners.id })
    if (row) partnerIds.push(row.id)
  }

  const testimonialIds: string[] = []
  for (const [index, testimonial] of TESTIMONIALS.entries()) {
    const [row] = await db
      .insert(schema.testimonials)
      .values({
        authorName: `${MARK}${testimonial.author}`,
        organisation: testimonial.organisation,
        projectId: projectIds[testimonial.project] ?? null,
        isPublished: PUBLISH,
        sortOrder: index,
      })
      .returning({ id: schema.testimonials.id })

    if (!row) continue
    testimonialIds.push(row.id)

    await db.insert(schema.testimonialTranslations).values(
      LOCALES.map((locale) => ({
        testimonialId: row.id,
        locale,
        role: testimonial.role[locale],
        quote: testimonial.quote[locale],
      })),
    )
  }

  const faqIds: string[] = []
  for (const [index, faq] of FAQS.entries()) {
    const [row] = await db
      .insert(schema.faqs)
      .values({ category: faq.category, isPublished: PUBLISH, sortOrder: index })
      .returning({ id: schema.faqs.id })

    if (!row) continue
    faqIds.push(row.id)

    await db.insert(schema.faqTranslations).values(
      LOCALES.map((locale) => ({
        faqId: row.id,
        locale,
        question: `${MARK}${faq.question[locale]}`,
        answerHtml: faq.answer[locale],
      })),
    )
  }

  console.log(
    `  team: ${TEAM.length}  partners: ${partnerIds.length}  testimonials: ${testimonialIds.length}  faqs: ${faqIds.length}`,
  )
  return { faqIds, partnerIds, testimonialIds }
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

const POSTS = [
  {
    base: 'reading-a-drilling-log',
    category: 'field-notes',
    minutes: 6,
    title: {
      en: 'How to read a drilling log',
      fr: 'Comment lire un rapport de forage',
      it: 'Come si legge un rapporto di perforazione',
      de: 'Wie man ein Bohrprotokoll liest',
    },
    excerpt: {
      en: 'The document handed over at completion, explained line by line — and the one number to check first.',
      fr: 'Le document remis à la réception, expliqué ligne par ligne — et le chiffre à vérifier en premier.',
      it: 'Il documento consegnato al collaudo, spiegato riga per riga — e il numero da controllare per primo.',
      de: 'Das bei der Abnahme übergebene Dokument, Zeile für Zeile erklärt — und die Zahl, die zuerst zu prüfen ist.',
    },
    body: {
      en: '<h2>What the log records</h2><p>A drilling log is the borehole’s birth certificate. It records the formations passed through and at what depth, where water was struck, the position of casing and screen, and the yield measured at the end of development.</p><h2>Why the strata matter</h2><p>The sequence of formations tells you whether the supply is likely to be seasonal. A borehole drawing from weathered overburden behaves differently in a dry year from one drawing from fractured basement, and the log is the only place that distinction is written down.</p><h2>The number to check first</h2><p>Yield at completion — and specifically whether it was measured after development or during drilling. A figure taken while the hole is still being flushed is not a yield, and a figure quoted without saying when it was taken should be treated as no figure at all.</p><h2>What to do with it</h2><p>Keep it. When a pump fails five years later, the log is what tells the next engineer whether the borehole is worth rehabilitating or whether the problem is below the pump.</p>',
      fr: "<h2>Ce que consigne le rapport</h2><p>Un rapport de forage est l'acte de naissance de l'ouvrage. Il consigne les formations traversées et à quelle profondeur, l'endroit où l'eau a été rencontrée, la position du tubage et des crépines, et le débit mesuré à l'issue du développement.</p><h2>Pourquoi les strates comptent</h2><p>La succession des formations indique si la ressource risque d'être saisonnière. Un forage exploitant des altérites ne se comporte pas, en année sèche, comme un forage exploitant un socle fracturé — et le rapport est le seul endroit où cette distinction est écrite.</p><h2>Le chiffre à vérifier en premier</h2><p>Le débit à la réception — et surtout : mesuré après développement ou pendant le forage ? Un chiffre relevé alors que l'ouvrage est encore en cours de nettoyage n'est pas un débit, et un débit annoncé sans préciser sa date doit être considéré comme inexistant.</p><h2>Qu'en faire</h2><p>Le conserver. Quand une pompe lâchera cinq ans plus tard, c'est le rapport qui dira au technicien suivant si l'ouvrage vaut une réhabilitation ou si le problème se situe sous la pompe.</p>",
      it: "<h2>Cosa registra il rapporto</h2><p>Un rapporto di perforazione è l'atto di nascita del pozzo. Registra le formazioni attraversate e a quale profondità, dove è stata incontrata l'acqua, la posizione di rivestimento e filtri, e la portata misurata al termine dello spurgo.</p><h2>Perché contano gli strati</h2><p>La successione delle formazioni dice se la risorsa rischia di essere stagionale. Un pozzo che attinge da coltre alterata si comporta, in un anno secco, diversamente da uno che attinge da basamento fratturato — e il rapporto è l'unico posto in cui quella distinzione è scritta.</p><h2>Il numero da controllare per primo</h2><p>La portata al collaudo — e soprattutto: misurata dopo lo spurgo o durante la perforazione? Un valore preso mentre il foro è ancora in pulizia non è una portata, e una portata dichiarata senza dire quando è stata rilevata va considerata inesistente.</p><h2>Cosa farne</h2><p>Conservarlo. Quando fra cinque anni una pompa cederà, è il rapporto a dire al tecnico successivo se il pozzo vale una riabilitazione o se il problema sta sotto la pompa.</p>",
      de: '<h2>Was das Protokoll festhält</h2><p>Ein Bohrprotokoll ist die Geburtsurkunde des Brunnens. Es hält fest, welche Formationen in welcher Tiefe durchbohrt wurden, wo Wasser angetroffen wurde, wie Verrohrung und Filterstrecke liegen und welche Ergiebigkeit am Ende der Entwicklung gemessen wurde.</p><h2>Warum die Schichten zählen</h2><p>Die Abfolge der Formationen zeigt, ob die Versorgung saisonal sein dürfte. Ein Brunnen im verwitterten Deckgebirge verhält sich in einem trockenen Jahr anders als einer im klüftigen Grundgebirge — und das Protokoll ist der einzige Ort, an dem dieser Unterschied festgehalten ist.</p><h2>Die Zahl, die zuerst zu prüfen ist</h2><p>Die Ergiebigkeit bei Abnahme — und vor allem: nach der Entwicklung gemessen oder während der Bohrung? Ein Wert, der bei noch laufender Spülung abgelesen wurde, ist keine Ergiebigkeit; eine Angabe ohne Zeitpunkt ist als nicht vorhanden zu behandeln.</p><h2>Was man damit macht</h2><p>Aufbewahren. Wenn fünf Jahre später eine Pumpe ausfällt, sagt das Protokoll der nächsten Fachkraft, ob sich eine Instandsetzung lohnt oder ob das Problem unterhalb der Pumpe liegt.</p>',
    },
  },
  {
    base: 'what-water-testing-shows',
    category: 'water-quality',
    minutes: 5,
    title: {
      en: 'What a water test does and does not tell you',
      fr: "Ce qu'une analyse d'eau dit — et ne dit pas",
      it: "Cosa dice e cosa non dice un'analisi dell'acqua",
      de: 'Was eine Wasseranalyse aussagt — und was nicht',
    },
    excerpt: {
      en: 'A clean result on the day of handover is a snapshot, not a guarantee. What matters is the second test.',
      fr: 'Un résultat conforme le jour de la remise est un instantané, pas une garantie. Ce qui compte, c’est la seconde analyse.',
      it: 'Un esito conforme il giorno della consegna è un’istantanea, non una garanzia. Conta la seconda analisi.',
      de: 'Ein sauberes Ergebnis am Übergabetag ist eine Momentaufnahme, keine Garantie. Entscheidend ist die zweite Probe.',
    },
    body: {
      en: '<h2>The tests we run</h2><p>Bacteriological, pH, conductivity, turbidity, iron and fluoride. The first determines whether the water is safe to drink today. The others determine whether people will still be drinking it in a year.</p><h2>Why taste matters as much as safety</h2><p>Water that is microbiologically safe but tastes of iron gets abandoned for the stream, and a borehole nobody uses has failed whatever the laboratory certificate says. Iron above roughly 0.3 mg/l is the usual culprit, and it is a design question — not a health one.</p><h2>The second test is the real one</h2><p>Contamination almost never arrives with the water. It arrives afterwards, through a cracked apron, a damaged seal or an unprotected head, weeks or months after everyone has gone home. Retesting at the maintenance visit is what turns a one-day result into an ongoing statement.</p><h2>What we publish</h2><p>Certificates are attached to the water point in the public register, with the date they were taken. A certificate without a date is decoration.</p>',
      fr: "<h2>Les analyses réalisées</h2><p>Bactériologie, pH, conductivité, turbidité, fer et fluorures. La première détermine si l'eau est potable aujourd'hui. Les autres déterminent si elle sera encore bue dans un an.</p><h2>Pourquoi le goût compte autant que la sécurité</h2><p>Une eau microbiologiquement sûre mais au goût de fer est délaissée au profit du ruisseau, et un forage que personne n'utilise a échoué, quoi qu'en dise le certificat. Le fer au-delà d'environ 0,3 mg/l est le coupable habituel : c'est une question de conception, pas de santé.</p><h2>La vraie analyse est la seconde</h2><p>La contamination n'arrive presque jamais avec l'eau. Elle arrive ensuite, par une margelle fissurée, un joint endommagé ou une tête non protégée, des semaines ou des mois après le départ de tout le monde. La contre-analyse lors de la visite de maintenance transforme un résultat ponctuel en constat durable.</p><h2>Ce que nous publions</h2><p>Les certificats sont rattachés au point d'eau dans le registre public, avec leur date de prélèvement. Un certificat sans date est un ornement.</p>",
      it: "<h2>Le analisi che eseguiamo</h2><p>Batteriologica, pH, conducibilità, torbidità, ferro e fluoruri. La prima stabilisce se l'acqua è potabile oggi. Le altre stabiliscono se la si berrà ancora fra un anno.</p><h2>Perché il sapore conta quanto la sicurezza</h2><p>Un'acqua microbiologicamente sicura ma che sa di ferro viene abbandonata per il torrente, e un pozzo che nessuno usa ha fallito qualunque cosa dica il certificato. Il ferro oltre circa 0,3 mg/l è il colpevole abituale: è una questione di progetto, non sanitaria.</p><h2>La vera analisi è la seconda</h2><p>La contaminazione non arriva quasi mai con l'acqua. Arriva dopo, da una platea crepata, una guarnizione danneggiata o una testa non protetta, settimane o mesi dopo che tutti sono andati via. La controanalisi alla visita di manutenzione trasforma un esito di un giorno in un'affermazione nel tempo.</p><h2>Cosa pubblichiamo</h2><p>I certificati sono allegati al punto d'acqua nel registro pubblico, con la data del prelievo. Un certificato senza data è un ornamento.</p>",
      de: '<h2>Die Analysen, die wir durchführen</h2><p>Bakteriologie, pH-Wert, Leitfähigkeit, Trübung, Eisen und Fluorid. Die erste entscheidet, ob das Wasser heute trinkbar ist. Die übrigen entscheiden, ob es in einem Jahr noch getrunken wird.</p><h2>Warum Geschmack ebenso zählt wie Sicherheit</h2><p>Wasser, das mikrobiologisch einwandfrei ist, aber nach Eisen schmeckt, wird zugunsten des Bachs aufgegeben — und ein Brunnen, den niemand nutzt, ist gescheitert, was das Zertifikat auch sagt. Eisen über etwa 0,3 mg/l ist der übliche Verursacher, und das ist eine Frage der Auslegung, keine der Gesundheit.</p><h2>Die zweite Probe ist die eigentliche</h2><p>Verunreinigungen kommen fast nie mit dem Wasser. Sie kommen danach — durch eine gerissene Brunnenschürze, eine beschädigte Dichtung oder einen ungeschützten Kopf, Wochen oder Monate nachdem alle abgereist sind. Die Nachbeprobung beim Wartungsbesuch macht aus einem Tagesergebnis eine belastbare Aussage.</p><h2>Was wir veröffentlichen</h2><p>Zertifikate hängen im öffentlichen Register an der Wasserstelle, mit dem Entnahmedatum. Ein Zertifikat ohne Datum ist Dekoration.</p>',
    },
  },
  {
    base: 'why-we-publish-response-times',
    category: 'maintenance',
    minutes: 4,
    title: {
      en: 'Why we publish our response times',
      fr: 'Pourquoi nous publions nos délais d’intervention',
      it: 'Perché pubblichiamo i nostri tempi di intervento',
      de: 'Warum wir unsere Reaktionszeiten veröffentlichen',
    },
    excerpt: {
      en: 'A promise nobody can check is a marketing claim. A published median that can go the wrong way is not.',
      fr: "Une promesse invérifiable est un argument marketing. Une médiane publiée qui peut se dégrader ne l'est pas.",
      it: 'Una promessa non verificabile è uno slogan. Una mediana pubblicata che può peggiorare no.',
      de: 'Ein unüberprüfbares Versprechen ist Werbung. Ein veröffentlichter Median, der sich verschlechtern kann, nicht.',
    },
    body: {
      en: '<h2>The problem with “we maintain what we build”</h2><p>Everyone in this sector says it. The sentence costs nothing and commits to nothing, which is exactly why it appears on every website in the industry — including the ones whose pumps have stood dry for two years.</p><h2>What we publish instead</h2><p>The number of faults currently open, the median hours from report to acknowledgement, the median hours from report to repair, and the share of covered water points found working at the last visit. All four are recalculated from the actual fault records, not typed into a settings field.</p><h2>Why the median and not the average</h2><p>One water point in a district cut off by rain for three weeks would drag an average far enough to make it meaningless. The question a partner is actually asking is "how long does this usually take", and that is a median.</p><h2>What it costs us</h2><p>A bad month is visible to everyone, including the NGO deciding whether to place the next contract. That is the point. A figure that can only improve is not a measurement, it is a slogan with a number in it.</p>',
      fr: "<h2>Le problème avec « nous entretenons ce que nous construisons »</h2><p>Tout le monde dans ce secteur le dit. La phrase ne coûte rien et n'engage à rien : c'est précisément pourquoi elle figure sur tous les sites du métier — y compris ceux dont les pompes sont à sec depuis deux ans.</p><h2>Ce que nous publions à la place</h2><p>Le nombre de pannes actuellement ouvertes, le délai médian en heures entre le signalement et l'accusé de réception, le délai médian entre le signalement et la réparation, et la part des points d'eau couverts trouvés en état de marche à la dernière visite. Ces quatre chiffres sont recalculés à partir des signalements réels, non saisis dans un champ de configuration.</p><h2>Pourquoi la médiane et non la moyenne</h2><p>Un seul point d'eau dans un district coupé par les pluies pendant trois semaines suffirait à rendre une moyenne inexploitable. La question que pose réellement un partenaire est « combien de temps cela prend-il habituellement » : c'est une médiane.</p><h2>Ce que cela nous coûte</h2><p>Un mauvais mois est visible de tous, y compris de l'ONG qui décide du prochain contrat. C'est l'objectif. Un chiffre qui ne peut que s'améliorer n'est pas une mesure, c'est un slogan avec un nombre dedans.</p>",
      it: "<h2>Il problema con «manuteniamo ciò che costruiamo»</h2><p>In questo settore lo dicono tutti. La frase non costa nulla e non impegna a nulla: è esattamente per questo che compare su ogni sito del ramo — compresi quelli le cui pompe sono a secco da due anni.</p><h2>Cosa pubblichiamo invece</h2><p>Il numero di guasti attualmente aperti, le ore mediane dalla segnalazione alla presa in carico, le ore mediane dalla segnalazione alla riparazione e la quota di punti d'acqua coperti trovati funzionanti all'ultima visita. Tutti e quattro sono ricalcolati dai registri reali dei guasti, non digitati in un campo di configurazione.</p><h2>Perché la mediana e non la media</h2><p>Un solo punto d'acqua in un distretto isolato dalle piogge per tre settimane basterebbe a rendere inservibile una media. La domanda che un partner si pone davvero è «quanto tempo ci vuole di solito»: ed è una mediana.</p><h2>Quanto ci costa</h2><p>Un mese storto è visibile a tutti, compresa la ONG che deve decidere il prossimo contratto. È proprio questo il punto. Un numero che può solo migliorare non è una misura, è uno slogan con dentro una cifra.</p>",
      de: '<h2>Das Problem mit „Wir warten, was wir bauen“</h2><p>In dieser Branche sagt das jeder. Der Satz kostet nichts und verpflichtet zu nichts — genau deshalb steht er auf jeder Website des Gewerbes, auch auf denen, deren Pumpen seit zwei Jahren trocken stehen.</p><h2>Was wir stattdessen veröffentlichen</h2><p>Die Zahl der aktuell offenen Störungen, die medianen Stunden von der Meldung bis zur Bestätigung, die medianen Stunden von der Meldung bis zur Reparatur und den Anteil der betreuten Wasserstellen, die beim letzten Besuch funktionierten. Alle vier werden aus den tatsächlichen Störungsdaten neu berechnet, nicht in ein Einstellungsfeld getippt.</p><h2>Warum der Median und nicht der Mittelwert</h2><p>Eine einzige Wasserstelle in einem drei Wochen lang verregneten, abgeschnittenen Distrikt würde einen Mittelwert so verzerren, dass er nichts mehr aussagt. Die Frage, die ein Partner wirklich stellt, lautet „wie lange dauert das üblicherweise“ — und das ist ein Median.</p><h2>Was es uns kostet</h2><p>Ein schlechter Monat ist für alle sichtbar, auch für die NGO, die über den nächsten Auftrag entscheidet. Das ist der Sinn. Eine Zahl, die sich nur verbessern kann, ist keine Messung, sondern ein Slogan mit einer Ziffer darin.</p>',
    },
  },
  {
    base: 'rehabilitate-before-you-drill',
    category: 'field-notes',
    minutes: 5,
    title: {
      en: 'Rehabilitate before you drill',
      fr: 'Réhabiliter avant de forer',
      it: 'Riabilitare prima di perforare',
      de: 'Instandsetzen, bevor gebohrt wird',
    },
    excerpt: {
      en: 'A broken borehole in the village is often a better investment than a new one beside it — and easier to fund badly.',
      fr: 'Un forage en panne au village est souvent un meilleur investissement qu’un forage neuf à côté — et plus difficile à financer.',
      it: 'Un pozzo guasto in villaggio è spesso un investimento migliore di uno nuovo accanto — e più difficile da far finanziare.',
      de: 'Ein defektes Bohrloch im Dorf ist oft die bessere Investition als ein neues daneben — und schwerer zu finanzieren.',
    },
    body: {
      en: '<h2>The arithmetic</h2><p>A rehabilitation typically costs a quarter to a third of a new hand-pump borehole and takes weeks rather than months. Where the borehole itself is sound — and it usually is — the failure sits in the pump, the rising main or the apron, none of which required drilling to install and none of which requires drilling to replace.</p><h2>When it is not the answer</h2><p>A collapsed hole, a hole that has gone dry as the water table dropped, or one sited badly in the first place cannot be rescued by new parts. The survey has to happen either way, which is why we survey before quoting rather than after.</p><h2>Why it gets skipped</h2><p>New construction photographs better and funds more easily. A ribbon-cutting on a rehabilitation is a harder press release than a ribbon-cutting on a new well, even when it serves the same households for a third of the money.</p><h2>What to ask for</h2><p>Before approving a new borehole within a kilometre of a broken one, ask for the original drilling log and the reason the old one failed. If nobody can produce either, that is itself the finding.</p>',
      fr: "<h2>L'arithmétique</h2><p>Une réhabilitation coûte généralement le quart au tiers d'un forage neuf à pompe à main et prend des semaines plutôt que des mois. Lorsque l'ouvrage lui-même est sain — et il l'est le plus souvent — la défaillance se situe dans la pompe, la colonne montante ou la margelle : aucun de ces éléments n'a nécessité de forage pour être posé, aucun n'en nécessite pour être remplacé.</p><h2>Quand ce n'est pas la solution</h2><p>Un ouvrage effondré, tari à mesure que la nappe baissait, ou mal implanté au départ ne se sauve pas avec des pièces neuves. L'étude reste nécessaire dans tous les cas — c'est pourquoi nous étudions avant de chiffrer, et non après.</p><h2>Pourquoi on l'écarte</h2><p>Une construction neuve se photographie mieux et se finance plus facilement. L'inauguration d'une réhabilitation fait un communiqué plus difficile que celle d'un puits neuf, même lorsqu'elle dessert les mêmes ménages pour le tiers du prix.</p><h2>Ce qu'il faut demander</h2><p>Avant d'approuver un forage neuf à moins d'un kilomètre d'un ouvrage en panne, demandez le rapport de forage d'origine et la cause de la défaillance. Si personne ne peut fournir ni l'un ni l'autre, c'est en soi le résultat de l'enquête.</p>",
      it: "<h2>L'aritmetica</h2><p>Una riabilitazione costa di norma da un quarto a un terzo di un nuovo pozzo con pompa a mano e richiede settimane anziché mesi. Quando il pozzo è integro — e di solito lo è — il guasto sta nella pompa, nella colonna montante o nella platea: nessuno di questi ha richiesto una perforazione per essere posato, nessuno la richiede per essere sostituito.</p><h2>Quando non è la risposta</h2><p>Un foro collassato, uno prosciugato al calare della falda o uno ubicato male in partenza non si salva con pezzi nuovi. Il rilievo serve comunque — ed è per questo che rileviamo prima di preventivare, non dopo.</p><h2>Perché la si salta</h2><p>Una costruzione nuova si fotografa meglio e si finanzia più facilmente. L'inaugurazione di una riabilitazione è un comunicato più difficile di quella di un pozzo nuovo, anche quando serve le stesse famiglie a un terzo del costo.</p><h2>Cosa chiedere</h2><p>Prima di approvare un nuovo pozzo entro un chilometro da uno guasto, chiedete il rapporto di perforazione originale e la causa del guasto. Se nessuno riesce a produrre né l'uno né l'altra, quello è già il risultato dell'indagine.</p>",
      de: '<h2>Die Rechnung</h2><p>Eine Instandsetzung kostet in der Regel ein Viertel bis ein Drittel einer neuen Handpumpenbohrung und dauert Wochen statt Monate. Ist das Bohrloch selbst intakt — und das ist es meist —, liegt der Ausfall an Pumpe, Steigleitung oder Brunnenschürze: Für keines davon war eine Bohrung nötig, für keinen Austausch ist eine nötig.</p><h2>Wann sie nicht die Antwort ist</h2><p>Ein verstürztes Bohrloch, eines, das mit sinkendem Grundwasserspiegel trockengefallen ist, oder ein von vornherein schlecht gesetztes lässt sich mit neuen Teilen nicht retten. Die Erkundung ist ohnehin nötig — deshalb erkunden wir vor der Kalkulation und nicht danach.</p><h2>Warum sie übersprungen wird</h2><p>Ein Neubau fotografiert sich besser und finanziert sich leichter. Die Einweihung einer Instandsetzung gibt eine schwierigere Pressemitteilung her als die eines neuen Brunnens — auch wenn sie dieselben Haushalte zu einem Drittel der Kosten versorgt.</p><h2>Wonach zu fragen ist</h2><p>Bevor eine Neubohrung im Umkreis eines Kilometers um ein defektes Bohrloch genehmigt wird: nach dem ursprünglichen Bohrprotokoll und nach der Ausfallursache fragen. Kann niemand beides vorlegen, ist genau das der Befund.</p>',
    },
  },
] as const

async function seedPosts(categoryIds: Record<string, string>) {
  const now = Date.now()

  for (const [index, post] of POSTS.entries()) {
    const [row] = await db
      .insert(schema.posts)
      .values({
        categoryId: categoryIds[post.category] ?? null,
        status,
        isFeatured: index === 0,
        readingMinutes: post.minutes,
        publishedAt: PUBLISH ? new Date(now - index * 86_400_000 * 9) : null,
      })
      .returning({ id: schema.posts.id })

    if (!row) continue

    await db.insert(schema.postTranslations).values(
      LOCALES.map((locale) => ({
        postId: row.id,
        locale,
        title: `${MARK}${post.title[locale]}`,
        slug: slug(`${post.base}-${locale}`),
        excerpt: post.excerpt[locale],
        contentHtml: post.body[locale],
        seoTitle: `${MARK}${post.title[locale]}`,
        seoDescription: post.excerpt[locale].slice(0, 160),
      })),
    )
  }

  console.log(`  posts: ${POSTS.length} (${status})`)
}

// ---------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------

async function seedCampaign(projectIds: Record<string, string>) {
  const [row] = await db
    .insert(schema.campaigns)
    .values({
      projectId: projectIds['kalungi-shallow-wells'] ?? null,
      status,
      isFeatured: true,
      goalAmount: 9400 * 100,
      raisedAmount: 0,
      offlineAmount: 0,
      currency: 'EUR',
      startsOn: '2026-08-01',
      endsOn: '2026-12-31',
      suggestedAmounts: [25, 50, 100, 250],
      allowCustomAmount: true,
      publishedAt,
    })
    .returning({ id: schema.campaigns.id })

  if (!row) return

  const title: T = {
    en: 'Three wells for Kalungi',
    fr: 'Trois puits pour Kalungi',
    it: 'Tre pozzi per Kalungi',
    de: 'Drei Brunnen für Kalungi',
  }
  const summary: T = {
    en: 'Surveyed, costed and ready to start. €9,400 covers all three hand-dug wells, the aprons and the committee training.',
    fr: 'Étudiés, chiffrés et prêts à démarrer. 9 400 € couvrent les trois puits, les margelles et la formation du comité.',
    it: 'Rilevati, preventivati e pronti a partire. 9.400 € coprono i tre pozzi, le platee e la formazione del comitato.',
    de: 'Erhoben, kalkuliert und startbereit. 9.400 € decken alle drei Brunnen, die Schürzen und die Komiteeschulung.',
  }
  const body: T = {
    en: '<p>Three lined hand-dug wells at Kalungi, Nakasongola district, where the water table sits within twenty metres and the overburden is stable enough to dig rather than drill.</p><p>The survey is complete and the sites are agreed with the sub-county. Nothing has been promised to the community: work starts when the funding is confirmed, which is the only honest order to do it in.</p>',
    fr: "<p>Trois puits maçonnés creusés à la main à Kalungi, district de Nakasongola, où la nappe est à moins de vingt mètres et les altérites assez stables pour creuser plutôt que forer.</p><p>L'étude est terminée et les sites validés avec la sous-préfecture. Rien n'a été promis à la communauté : les travaux démarrent une fois le financement confirmé — le seul ordre honnête.</p>",
    it: '<p>Tre pozzi scavati a mano e rivestiti a Kalungi, distretto di Nakasongola, dove la falda è entro i venti metri e la coltre è abbastanza stabile da scavare anziché perforare.</p><p>Il rilievo è concluso e i siti sono concordati con la sotto-contea. Alla comunità non è stato promesso nulla: i lavori partono a finanziamento confermato, che è l’unico ordine onesto.</p>',
    de: '<p>Drei ausgemauerte Handbrunnen in Kalungi, Distrikt Nakasongola, wo der Grundwasserspiegel innerhalb von zwanzig Metern liegt und das Deckgebirge standfest genug ist, um zu graben statt zu bohren.</p><p>Die Erhebung ist abgeschlossen, die Standorte sind mit der Sub-County abgestimmt. Der Gemeinde wurde nichts versprochen: Die Arbeiten beginnen nach Finanzierungszusage — die einzig redliche Reihenfolge.</p>',
  }

  await db.insert(schema.campaignTranslations).values(
    LOCALES.map((locale) => ({
      campaignId: row.id,
      locale,
      title: `${MARK}${title[locale]}`,
      slug: slug(`kalungi-wells-${locale}`),
      summary: summary[locale],
      contentHtml: body[locale],
      seoTitle: `${MARK}${title[locale]}`,
      seoDescription: summary[locale].slice(0, 160),
    })),
  )

  console.log(`  campaigns: 1 (${status})`)
}

// ---------------------------------------------------------------------------
// Pages
//
// Block ids are prefixed with the page key: `--purge` uses that to tell its own
// work from anything edited afterwards, and refuses to touch the latter.
// ---------------------------------------------------------------------------

type Ids = { faqIds: string[]; partnerIds: string[]; testimonialIds: string[] }

function homeBlocks({ faqIds }: Ids): unknown[] {
  return [
    {
      id: 'home-hero',
      kind: 'hero',
      layout: { paddingTop: 'xl', paddingBottom: 'xl', width: 'wide' },
      eyebrow: t({
        en: 'Water well drilling in Uganda',
        fr: 'Forage de puits en Ouganda',
        it: 'Perforazione di pozzi in Uganda',
        de: 'Brunnenbohrungen in Uganda',
      }),
      title: t({
        en: 'Boreholes that are still working in five years',
        fr: 'Des forages encore en service dans cinq ans',
        it: 'Pozzi ancora in funzione fra cinque anni',
        de: 'Bohrlöcher, die in fünf Jahren noch laufen',
      }),
      subtitle: t({
        en: `${COMPANY} drills, hands over with the paperwork, and publishes what happens afterwards — including the months that go badly.`,
        fr: `${COMPANY} fore, remet l'ouvrage avec son dossier, et publie ce qui se passe ensuite — y compris les mois difficiles.`,
        it: `${COMPANY} perfora, consegna con tutta la documentazione e pubblica cosa succede dopo — compresi i mesi storti.`,
        de: `${COMPANY} bohrt, übergibt samt Unterlagen und veröffentlicht, was danach passiert — auch die schlechten Monate.`,
      }),
      ctas: [
        {
          label: t({
            en: 'See the water points',
            fr: "Voir les points d'eau",
            it: "Vedi i punti d'acqua",
            de: 'Wasserstellen ansehen',
          }),
          href: '/projects',
          variant: 'primary',
        },
        {
          label: t({
            en: 'Request a quote',
            fr: 'Demander un devis',
            it: 'Richiedi un preventivo',
            de: 'Angebot anfordern',
          }),
          href: '/contact',
          variant: 'outline',
        },
      ],
    },
    {
      id: 'home-stats',
      kind: 'stats',
      layout: { tone: 'surface' },
      title: t({
        en: 'Where things stand',
        fr: 'Où nous en sommes',
        it: 'A che punto siamo',
        de: 'Aktueller Stand',
      }),
      subtitle: t({
        en: 'Recalculated from the delivery record, not typed into a settings field.',
        fr: 'Recalculé à partir du registre des réalisations, non saisi dans un champ de configuration.',
        it: 'Ricalcolato dal registro delle realizzazioni, non digitato in un campo di configurazione.',
        de: 'Aus dem Leistungsregister neu berechnet, nicht in ein Einstellungsfeld getippt.',
      }),
      items: [
        {
          value: '6',
          label: t({
            en: 'Water points',
            fr: "Points d'eau",
            it: "Punti d'acqua",
            de: 'Wasserstellen',
          }),
        },
        {
          value: '7,440',
          label: t({
            en: 'People served',
            fr: 'Personnes desservies',
            it: 'Persone servite',
            de: 'Versorgte Menschen',
          }),
        },
        {
          value: '6',
          label: t({ en: 'Districts', fr: 'Districts', it: 'Distretti', de: 'Distrikte' }),
        },
        {
          value: '9',
          suffix: ' min',
          label: t({
            en: 'Median walk after',
            fr: 'Trajet médian après',
            it: 'Percorso mediano dopo',
            de: 'Medianer Weg danach',
          }),
        },
      ],
    },
    {
      id: 'home-steps',
      kind: 'steps',
      layout: {},
      title: t({
        en: 'How a water point gets built',
        fr: "Comment un point d'eau est construit",
        it: "Come nasce un punto d'acqua",
        de: 'Wie eine Wasserstelle entsteht',
      }),
      subtitle: t({
        en: 'Four stages, each ending in a document you keep.',
        fr: 'Quatre étapes, chacune close par un document que vous conservez.',
        it: 'Quattro fasi, ciascuna chiusa da un documento che resta a voi.',
        de: 'Vier Schritte, jeder endet mit einem Dokument, das bei Ihnen bleibt.',
      }),
      items: [
        {
          title: t({
            en: 'Survey and siting',
            fr: 'Étude et implantation',
            it: 'Rilievo e ubicazione',
            de: 'Erkundung und Standort',
          }),
          text: t({
            en: 'A resistivity survey gives a depth band, and the quote is priced against that band. The district water officer approves the point before a rig is mobilised.',
            fr: "Une étude de résistivité donne une fourchette de profondeur, sur laquelle le devis est chiffré. Le responsable de l'eau du district valide le point avant toute mobilisation.",
            it: 'Un rilievo di resistività fornisce una fascia di profondità, su cui si calcola il preventivo. Il responsabile idrico distrettuale approva il punto prima della mobilitazione.',
            de: 'Eine Widerstandsmessung liefert ein Tiefenband, auf das kalkuliert wird. Die Distriktbehörde genehmigt den Punkt, bevor ein Gerät mobilisiert wird.',
          }),
        },
        {
          title: t({
            en: 'Drilling and installation',
            fr: 'Forage et installation',
            it: 'Perforazione e installazione',
            de: 'Bohrung und Einbau',
          }),
          text: t({
            en: 'Casing, gravel pack, development until the water runs clear, then the pump and apron. The drilling log is written as it happens, not reconstructed afterwards.',
            fr: "Tubage, massif filtrant, développement jusqu'à eau claire, puis pompe et margelle. Le rapport de forage est rédigé au fil des travaux, non reconstitué après coup.",
            it: 'Rivestimento, dreno di ghiaia, spurgo fino ad acqua limpida, poi pompa e platea. Il rapporto di perforazione si scrive man mano, non si ricostruisce dopo.',
            de: 'Verrohrung, Kiesschüttung, Entwicklung bis klares Wasser, dann Pumpe und Schürze. Das Bohrprotokoll entsteht währenddessen, nicht im Nachhinein.',
          }),
        },
        {
          title: t({
            en: 'Testing and handover',
            fr: 'Analyses et remise',
            it: 'Analisi e consegna',
            de: 'Analysen und Übergabe',
          }),
          text: t({
            en: 'Water tests, two days of committee training, and a signed handover certificate with the drilling log and the test results attached.',
            fr: "Analyses d'eau, deux jours de formation du comité, et un certificat de remise signé avec rapport de forage et résultats d'analyse en annexe.",
            it: "Analisi dell'acqua, due giorni di formazione del comitato e un certificato di consegna firmato con rapporto e risultati allegati.",
            de: 'Wasseranalysen, zwei Tage Komiteeschulung und ein unterzeichnetes Übergabezertifikat mit Bohrprotokoll und Analyseergebnissen im Anhang.',
          }),
        },
        {
          title: t({
            en: 'Maintenance',
            fr: 'Maintenance',
            it: 'Manutenzione',
            de: 'Instandhaltung',
          }),
          text: t({
            en: 'A visit schedule, a named parts supplier, a fault form anyone can use without an account, and response times published rather than promised.',
            fr: "Un calendrier de visites, un fournisseur de pièces nommé, un formulaire de signalement utilisable sans compte, et des délais publiés plutôt que promis.",
            it: 'Un calendario di visite, un fornitore di ricambi indicato per nome, un modulo di segnalazione usabile senza account e tempi pubblicati anziché promessi.',
            de: 'Ein Besuchsplan, ein benannter Ersatzteillieferant, ein Störungsformular ohne Kontozwang und veröffentlichte statt versprochene Reaktionszeiten.',
          }),
        },
      ],
    },
    {
      id: 'home-projects',
      kind: 'projects',
      layout: { tone: 'surface' },
      title: t({
        en: 'Recent water points',
        fr: "Points d'eau récents",
        it: "Punti d'acqua recenti",
        de: 'Aktuelle Wasserstellen',
      }),
      subtitle: t({
        en: 'Each with its coordinates, depth, measured yield and the date it was handed over.',
        fr: 'Chacun avec ses coordonnées, sa profondeur, son débit mesuré et sa date de remise.',
        it: 'Ciascuno con coordinate, profondità, portata misurata e data di consegna.',
        de: 'Jede mit Koordinaten, Tiefe, gemessener Ergiebigkeit und Übergabedatum.',
      }),
      status: 'all',
      limit: 3,
      cta: {
        label: t({
          en: 'All water points',
          fr: "Tous les points d'eau",
          it: "Tutti i punti d'acqua",
          de: 'Alle Wasserstellen',
        }),
        href: '/projects',
        variant: 'outline',
      },
    },
    {
      id: 'home-map',
      kind: 'map',
      layout: {},
      title: t({
        en: 'Where we work',
        fr: 'Où nous intervenons',
        it: 'Dove operiamo',
        de: 'Wo wir arbeiten',
      }),
      subtitle: t({
        en: 'Central and eastern Uganda. Every marker is a water point with a public record behind it.',
        fr: "Centre et est de l'Ouganda. Chaque repère est un point d'eau adossé à un dossier public.",
        it: "Uganda centrale e orientale. Ogni segnaposto è un punto d'acqua con dietro un registro pubblico.",
        de: 'Zentral- und Ostuganda. Jede Markierung ist eine Wasserstelle mit öffentlichem Datensatz.',
      }),
      zoom: 7,
      center: { lat: 1.3733, lng: 32.2903 },
    },
    {
      id: 'home-answer',
      kind: 'answer',
      layout: { tone: 'muted', width: 'narrow' },
      question: t({
        en: 'How is a borehole priced in Uganda?',
        fr: 'Comment un forage est-il chiffré en Ouganda ?',
        it: 'Come si calcola il prezzo di un pozzo in Uganda?',
        de: 'Wie wird ein Bohrloch in Uganda kalkuliert?',
      }),
      answer: t({
        en: 'Drilling is priced per metre, by depth band and by geology, rather than as one price per borehole — soft overburden and hard basement at the same depth are different jobs. The metres are billed band by band, and the one-off items that do not scale with depth (mobilisation, casing, pump, apron) are quoted as separate lines.',
        fr: "Le forage est chiffré au mètre, par fourchette de profondeur et par géologie, plutôt qu'à un prix unique par ouvrage — altérites tendres et socle dur à la même profondeur sont deux chantiers différents. Les mètres sont facturés par tranche, et les postes forfaitaires indépendants de la profondeur (mobilisation, tubage, pompe, margelle) figurent en lignes distinctes.",
        it: "La perforazione si calcola al metro, per fascia di profondità e per geologia, anziché a prezzo unico per pozzo — coltre tenera e basamento duro alla stessa profondità sono lavori diversi. I metri si fatturano fascia per fascia, e le voci una tantum indipendenti dalla profondità (mobilitazione, rivestimento, pompa, platea) compaiono come righe separate.",
        de: 'Die Bohrung wird pro Meter kalkuliert, nach Tiefenband und Geologie, nicht als Pauschale je Bohrloch — weiches Deckgebirge und hartes Grundgebirge sind in gleicher Tiefe verschiedene Arbeiten. Die Meter werden bandweise abgerechnet, die tiefenunabhängigen Einmalposten (Mobilisierung, Verrohrung, Pumpe, Schürze) erscheinen als eigene Zeilen.',
      }),
      verifiedOn: '2026-08-12',
      sourceLabel: 'Placeholder content — verify against the current rate card before publishing',
    },
    {
      id: 'home-faq',
      kind: 'faq',
      layout: {},
      title: t({
        en: 'Common questions',
        fr: 'Questions fréquentes',
        it: 'Domande frequenti',
        de: 'Häufige Fragen',
      }),
      faqIds: faqIds.slice(0, 4),
    },
    {
      id: 'home-posts',
      kind: 'posts',
      layout: { tone: 'surface' },
      title: t({
        en: 'From the field',
        fr: 'Depuis le terrain',
        it: 'Dal campo',
        de: 'Aus dem Feld',
      }),
      limit: 3,
      cta: {
        label: t({
          en: 'All articles',
          fr: 'Tous les articles',
          it: 'Tutti gli articoli',
          de: 'Alle Beiträge',
        }),
        href: '/blog',
        variant: 'outline',
      },
    },
    {
      id: 'home-cta',
      kind: 'cta',
      layout: { tone: 'primary' },
      title: t({
        en: 'Planning a water programme?',
        fr: 'Vous préparez un programme eau ?',
        it: 'State pianificando un programma idrico?',
        de: 'Planen Sie ein Wasserprogramm?',
      }),
      text: t({
        en: 'Tell us the district, the number of water points and the timeframe. You get a quote priced against a depth band, with the fixed items itemised — not a brochure.',
        fr: "Indiquez-nous le district, le nombre de points d'eau et le calendrier. Vous recevrez un devis chiffré sur une fourchette de profondeur, postes forfaitaires détaillés — pas une plaquette.",
        it: "Indicateci il distretto, il numero di punti d'acqua e i tempi. Riceverete un preventivo calcolato su una fascia di profondità, con le voci fisse dettagliate — non una brochure.",
        de: 'Nennen Sie uns Distrikt, Zahl der Wasserstellen und Zeitrahmen. Sie erhalten ein auf ein Tiefenband kalkuliertes Angebot mit ausgewiesenen Festposten — keine Broschüre.',
      }),
      ctas: [
        {
          label: t({
            en: 'Request a quote',
            fr: 'Demander un devis',
            it: 'Richiedi un preventivo',
            de: 'Angebot anfordern',
          }),
          href: '/contact',
          variant: 'primary',
        },
      ],
    },
  ]
}

function aboutBlocks({ partnerIds, testimonialIds }: Ids): unknown[] {
  return [
    {
      id: 'about-intro',
      kind: 'richText',
      layout: { width: 'narrow' },
      title: t({ en: 'Who we are', fr: 'Qui nous sommes', it: 'Chi siamo', de: 'Wer wir sind' }),
      content: t({
        en: `<p>${COMPANY} is a drilling company working with NGOs, foundations and district authorities across central and eastern Uganda. We do the survey, the drilling, the installation and the maintenance that follows — and we publish the record of all four.</p><p>This paragraph is placeholder text. Replace it with ${COMPANY}'s own history, registration details and the year it started working, before the site is announced.</p>`,
        fr: `<p>${COMPANY} est une entreprise de forage travaillant avec des ONG, des fondations et des autorités de district dans le centre et l'est de l'Ouganda. Nous réalisons l'étude, le forage, l'installation et la maintenance qui suit — et nous publions le registre des quatre.</p><p>Ce paragraphe est un texte de remplacement. Remplacez-le par l'histoire de ${COMPANY}, ses mentions d'enregistrement et son année de création, avant l'annonce du site.</p>`,
        it: `<p>${COMPANY} è un'impresa di perforazione che lavora con ONG, fondazioni e autorità distrettuali nell'Uganda centrale e orientale. Curiamo il rilievo, la perforazione, l'installazione e la manutenzione successiva — e pubblichiamo il registro di tutte e quattro.</p><p>Questo paragrafo è un segnaposto. Sostituitelo con la storia di ${COMPANY}, i dati di registrazione e l'anno di inizio attività, prima di annunciare il sito.</p>`,
        de: `<p>${COMPANY} ist ein Bohrunternehmen, das mit NGOs, Stiftungen und Distriktbehörden in Zentral- und Ostuganda arbeitet. Wir übernehmen Erkundung, Bohrung, Einbau und die anschließende Instandhaltung — und veröffentlichen den Nachweis zu allen vieren.</p><p>Dieser Absatz ist ein Platzhalter. Ersetzen Sie ihn vor der Ankündigung der Website durch die Geschichte von ${COMPANY}, die Registerangaben und das Gründungsjahr.</p>`,
      }),
    },
    {
      id: 'about-stats',
      kind: 'stats',
      layout: { tone: 'surface' },
      title: t({ en: 'In numbers', fr: 'En chiffres', it: 'In numeri', de: 'In Zahlen' }),
      items: [
        {
          value: '19',
          label: t({
            en: 'Years drilling',
            fr: 'Années de forage',
            it: 'Anni di perforazioni',
            de: 'Jahre Bohrerfahrung',
          }),
        },
        {
          value: '6',
          label: t({
            en: 'Districts worked in',
            fr: 'Districts couverts',
            it: 'Distretti in cui operiamo',
            de: 'Distrikte im Einsatz',
          }),
        },
        {
          value: '100%',
          label: t({
            en: 'Handovers with a signed certificate',
            fr: 'Remises avec certificat signé',
            it: 'Consegne con certificato firmato',
            de: 'Übergaben mit unterzeichnetem Zertifikat',
          }),
        },
      ],
    },
    {
      id: 'about-testimonials',
      kind: 'testimonials',
      layout: {},
      title: t({
        en: 'What partners say',
        fr: 'Ce que disent nos partenaires',
        it: 'Cosa dicono i partner',
        de: 'Was Partner sagen',
      }),
      testimonialIds,
    },
    {
      id: 'about-partners',
      kind: 'partners',
      layout: { tone: 'surface' },
      title: t({
        en: 'We work with',
        fr: 'Nous travaillons avec',
        it: 'Lavoriamo con',
        de: 'Wir arbeiten mit',
      }),
      partnerIds,
    },
  ]
}

function contactBlocks(): unknown[] {
  return [
    {
      id: 'contact-form',
      kind: 'contact',
      layout: {},
      title: t({
        en: 'Tell us what you need',
        fr: 'Dites-nous ce dont vous avez besoin',
        it: 'Diteci di cosa avete bisogno',
        de: 'Sagen Sie uns, was Sie brauchen',
      }),
      subtitle: t({
        en: 'District, number of water points, rough timeframe. We answer with a priced quote and a depth band, not a brochure.',
        fr: "District, nombre de points d'eau, calendrier approximatif. Nous répondons par un devis chiffré et une fourchette de profondeur, pas une plaquette.",
        it: "Distretto, numero di punti d'acqua, tempistiche di massima. Rispondiamo con un preventivo e una fascia di profondità, non con una brochure.",
        de: 'Distrikt, Zahl der Wasserstellen, ungefährer Zeitrahmen. Wir antworten mit einem kalkulierten Angebot und einem Tiefenband, nicht mit einer Broschüre.',
      }),
      variant: 'ngo',
      showDetails: true,
    },
  ]
}

/**
 * Validates against the real block schema before anything is written.
 *
 * `parseBlocks` silently drops blocks that do not validate, so a malformed
 * block would not error — it would simply never appear, with no signal why.
 * Parsing here turns that into a loud failure at seed time, and stores the
 * parsed output so the defaults Zod fills in are exactly what the admin reads.
 */
function validate(key: string, raw: unknown[]): Block[] {
  const parsed = blocksSchema.safeParse(raw)
  if (!parsed.success) {
    console.error(`Blocks for "${key}" are invalid:`)
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    throw new Error(`invalid blocks for page "${key}"`)
  }
  if (parsed.data.length !== raw.length) {
    throw new Error(`block count changed for "${key}" — refusing to write`)
  }
  return parsed.data
}

async function composePages(ids: Ids) {
  const wanted: { key: string; blocks: Block[] }[] = [
    { key: 'home', blocks: validate('home', homeBlocks(ids)) },
    { key: 'about', blocks: validate('about', aboutBlocks(ids)) },
    { key: 'contact', blocks: validate('contact', contactBlocks()) },
  ]

  let written = 0
  for (const page of wanted) {
    const [existing] = await db
      .select({ id: schema.pages.id, blocks: schema.pages.blocks })
      .from(schema.pages)
      .where(eq(schema.pages.key, page.key))
      .limit(1)

    if (!existing) {
      console.warn(`  ! page "${page.key}" not found — skipped`)
      continue
    }

    // Never overwrite work done in the admin.
    if ((existing.blocks ?? []).length > 0 && !FORCE) {
      console.warn(
        `  ! page "${page.key}" already has ${existing.blocks.length} block(s) — left alone (use --force to replace)`,
      )
      continue
    }

    await db.update(schema.pages).set({ blocks: page.blocks }).where(eq(schema.pages.id, existing.id))
    written += 1
  }

  console.log(`  pages composed: ${written}/${wanted.length}`)
}

// ---------------------------------------------------------------------------

async function main() {
  if (CHECK) {
    // Ids the real run supplies from the database; shape-valid stand-ins here.
    const sample = '00000000-0000-4000-8000-000000000000'
    const ids: Ids = { faqIds: [sample], partnerIds: [sample], testimonialIds: [sample] }
    const counts = [
      ['home', validate('home', homeBlocks(ids)).length],
      ['about', validate('about', aboutBlocks(ids)).length],
      ['contact', validate('contact', contactBlocks()).length],
    ] as const
    for (const [key, count] of counts) console.log(`  ${key}: ${count} blocks valid`)
    console.log('All blocks validate against blocksSchema.')
    return
  }

  if (PURGE) {
    await purge()
    return
  }

  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.projectTranslations)
    .where(like(schema.projectTranslations.slug, `${SLUG_PREFIX}%`))

  if ((existing?.count ?? 0) > 0) {
    console.error(
      'Placeholder content is already present. Run with --purge first if you want to reseed it.',
    )
    process.exitCode = 1
    return
  }

  console.log(`Seeding ${COMPANY} placeholder content (${status}, locales: ${LOCALES.join(', ')})…`)

  const categoryIds = await seedCategories()
  const projectIds = await seedProjects()
  const ids = await seedPeople(projectIds)
  await seedPosts(categoryIds)
  await seedCampaign(projectIds)
  await composePages(ids)

  console.log('\nDone.')
  if (!PUBLISH) {
    console.log(
      'Content is in draft: listings, open data, the register and the impact badge will not show it.\n' +
        'Review it in /admin, or re-run with --purge then --publish to render the site end to end.',
    )
  } else {
    console.log(
      'Content is published and publicly visible. Run `pnpm reindex` to index it for search and the assistant.',
    )
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => client.end({ timeout: 5 }))
