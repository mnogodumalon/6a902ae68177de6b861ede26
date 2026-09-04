import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
/** A raw record URL (applookup reference). NEVER render this directly
 *  in JSX — it is a URL, not a display value. Show the enriched `*Name`
 *  field or resolve it via the entity map instead. Assignable to/from
 *  string everywhere; the `& {}` keeps the alias NAME visible in tsc
 *  error messages (a plain primitive alias gets normalized away). */
export type RecordUrl = string & {};
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Zimmer {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    zimmernummer?: number;
    zimmertyp?: LookupValue;
    preis_pro_nacht?: number;
    max_personen?: number;
    foto?: string;
  };
}

export interface Buchungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    zimmer?: RecordUrl; // applookup -> URL zu 'Zimmer' Record
    anreisedatum?: string; // Format: YYYY-MM-DD oder ISO String
    abreisedatum?: string; // Format: YYYY-MM-DD oder ISO String
    vorname?: string;
    nachname?: string;
    email?: string;
    telefon?: string;
    anzahl_personen?: number;
    nachricht?: string;
    status?: LookupValue;
  };
}

export const APP_IDS = {
  ZIMMER: '6a902ad27153397501f248b1',
  BUCHUNGEN: '6a902ad573d35d6adf80587a',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'zimmer': {
    zimmertyp: [{ key: "doppelzimmer", get label() { return lookupLabel('zimmer', 'zimmertyp', "doppelzimmer") ?? "Doppelzimmer"; } }, { key: "familienzimmer", get label() { return lookupLabel('zimmer', 'zimmertyp', "familienzimmer") ?? "Familienzimmer"; } }, { key: "einzelzimmer", get label() { return lookupLabel('zimmer', 'zimmertyp', "einzelzimmer") ?? "Einzelzimmer"; } }],
  },
  'buchungen': {
    status: [{ key: "anfrage", get label() { return lookupLabel('buchungen', 'status', "anfrage") ?? "Anfrage"; } }, { key: "bestaetigt", get label() { return lookupLabel('buchungen', 'status', "bestaetigt") ?? "Bestätigt"; } }, { key: "eingecheckt", get label() { return lookupLabel('buchungen', 'status', "eingecheckt") ?? "Eingecheckt"; } }, { key: "ausgecheckt", get label() { return lookupLabel('buchungen', 'status', "ausgecheckt") ?? "Ausgecheckt"; } }, { key: "storniert", get label() { return lookupLabel('buchungen', 'status', "storniert") ?? "Storniert"; } }, { key: "abgelehnt", get label() { return lookupLabel('buchungen', 'status', "abgelehnt") ?? "Abgelehnt"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'zimmer': {
    'zimmernummer': 'number',
    'zimmertyp': 'lookup/radio',
    'preis_pro_nacht': 'number',
    'max_personen': 'number',
    'foto': 'file',
  },
  'buchungen': {
    'zimmer': 'applookup/select',
    'anreisedatum': 'date/date',
    'abreisedatum': 'date/date',
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'telefon': 'string/tel',
    'anzahl_personen': 'number',
    'nachricht': 'string/textarea',
    'status': 'lookup/select',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateZimmer = StripLookup<Zimmer['fields']>;
export type CreateBuchungen = StripLookup<Buchungen['fields']>;