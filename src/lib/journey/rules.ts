/**
 * Field rules — GENERATED from the app metadata. Do not edit.
 *
 * The mechanical truth about every field: what kind it is, whether the
 * platform's base view marks it required, which lookup keys exist, where an
 * applookup points, what the label is. `useStepForm` validates against these
 * rules and phrases its messages with the real labels; `toWirePayload` uses
 * them to shape the create payload; `SHAPES` tells a page which input FORM
 * fits the data (a date pair wants a calendar, not two fields) — it is a
 * signal, not a gate.
 */
import { appLabel, fieldLabel, lookupLabel } from '@/i18n';
import { LOOKUP_OPTIONS } from '@/types/app';

export type EntityKey = 'zimmer' | 'buchungen';

/** The text fields of each entity — what a search may run over (generated;
 *  `never` for an entity without text of its own, e.g. a link table). */
export interface StringFields {
  "zimmer": never;
  "buchungen": "vorname" | "nachname" | "email" | "telefon" | "nachricht";
}
export type StringFieldKey<E extends EntityKey> = E extends keyof StringFields ? StringFields[E] : never;

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'bool'
  | 'date'
  | 'datetime'
  | 'lookup'
  | 'multilookup'
  | 'record'
  | 'multirecord'
  | 'file'
  | 'geo';

export interface FieldRule {
  key: string;
  fulltype: string;
  kind: FieldKind;
  /** From the app's base view. A public page may override this per field. */
  required: boolean;
  /** Build-time label — `labelOf()` prefers the runtime i18n bundle. */
  label: string;
  /** Whether a journey may write it (`file` is upload-only, never via a journey). */
  writable: boolean;
  maxLength?: number;
  /** lookup / multilookup: the ONLY valid write values. */
  options?: string[];
  /** record / multirecord: the target app (always) and its entity key (when inside this appgroup). */
  targetAppId?: string;
  targetEntity?: EntityKey;
  format?: 'currency';
  /** HTML autocomplete token derived from the field name (given-name, email, tel, …). */
  autoComplete?: string;
}

export interface EntityInfo {
  key: EntityKey;
  appId: string;
  label: string;
  /** PascalCase plural — `get<pascal>()` on the service. */
  pascal: string;
  /** The single-record suffix — `create<single>()` on the service. */
  single: string;
}

/** Input-form signals per entity: which data shape each field (pair) has.
 *  `range`  — two date fields that form a stay/period → AvailabilityRangePicker
 *  `choice` — a lookup with few options → ChoiceGroup pills instead of a select
 *  `record` — an applookup → EntitySelectStep with search, never a raw id field
 *  `stock`  — a quantity that has a stock/capacity counterpart → show it, warn on overshoot */
export type Shape =
  | { kind: 'range'; from: string; to: string }
  | { kind: 'choice'; field: string; count: number }
  | { kind: 'record'; field: string; targetEntity?: EntityKey }
  | { kind: 'stock'; field: string };

export const ENTITIES: Record<EntityKey, EntityInfo> = {
  "zimmer": {
    "key": "zimmer",
    "appId": "6a902ad27153397501f248b1",
    "label": "Zimmer",
    "pascal": "Zimmer",
    "single": "ZimmerEntry"
  },
  "buchungen": {
    "key": "buchungen",
    "appId": "6a902ad573d35d6adf80587a",
    "label": "Buchungen",
    "pascal": "Buchungen",
    "single": "BuchungenEntry"
  }
};

export const FIELD_RULES: Record<EntityKey, Record<string, FieldRule>> = {
  "zimmer": {
    "zimmernummer": {
      "key": "zimmernummer",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Zimmernummer",
      "writable": true
    },
    "zimmertyp": {
      "key": "zimmertyp",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": true,
      "label": "Zimmertyp",
      "writable": true,
      "options": [
        "doppelzimmer",
        "familienzimmer",
        "einzelzimmer"
      ]
    },
    "preis_pro_nacht": {
      "key": "preis_pro_nacht",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Preis pro Nacht (€)",
      "writable": true,
      "format": "currency"
    },
    "max_personen": {
      "key": "max_personen",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Maximale Personenzahl",
      "writable": true
    },
    "foto": {
      "key": "foto",
      "fulltype": "file",
      "kind": "file",
      "required": false,
      "label": "Foto",
      "writable": false
    }
  },
  "buchungen": {
    "zimmer": {
      "key": "zimmer",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Zimmer",
      "writable": true,
      "targetAppId": "6a902ad27153397501f248b1",
      "targetEntity": "zimmer"
    },
    "anreisedatum": {
      "key": "anreisedatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Anreisedatum",
      "writable": true
    },
    "abreisedatum": {
      "key": "abreisedatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Abreisedatum",
      "writable": true
    },
    "vorname": {
      "key": "vorname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Vorname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "given-name"
    },
    "nachname": {
      "key": "nachname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Nachname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "family-name"
    },
    "email": {
      "key": "email",
      "fulltype": "string/email",
      "kind": "email",
      "required": true,
      "label": "E-Mail",
      "writable": true,
      "autoComplete": "email"
    },
    "telefon": {
      "key": "telefon",
      "fulltype": "string/tel",
      "kind": "tel",
      "required": false,
      "label": "Telefon",
      "writable": true,
      "autoComplete": "tel"
    },
    "anzahl_personen": {
      "key": "anzahl_personen",
      "fulltype": "number",
      "kind": "number",
      "required": true,
      "label": "Anzahl Personen",
      "writable": true
    },
    "nachricht": {
      "key": "nachricht",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Nachricht",
      "writable": true
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "anfrage",
        "bestaetigt",
        "eingecheckt",
        "ausgecheckt",
        "storniert",
        "abgelehnt"
      ]
    }
  }
};

export const SHAPES: Record<EntityKey, Shape[]> = {
  "zimmer": [
    {
      "kind": "choice",
      "field": "zimmertyp",
      "count": 3
    }
  ],
  "buchungen": [
    {
      "kind": "choice",
      "field": "status",
      "count": 6
    },
    {
      "kind": "record",
      "field": "zimmer",
      "targetEntity": "zimmer"
    }
  ]
};

export function ruleOf(entity: EntityKey, key: string): FieldRule | undefined {
  return FIELD_RULES[entity]?.[key];
}

/** The field label as the user sees it — runtime bundle first, generated label second. */
export function labelOf(entity: EntityKey, key: string): string {
  const fromBundle = fieldLabel(entity, key);
  if (fromBundle !== key) return fromBundle;
  return ruleOf(entity, key)?.label ?? key;
}

export function entityLabel(entity: EntityKey): string {
  const fromBundle = appLabel(entity);
  if (fromBundle !== entity) return fromBundle;
  return ENTITIES[entity]?.label ?? entity;
}

/** Lookup options with runtime labels — the only legitimate source of `{key,label}` pairs. */
export function optionsOf(entity: EntityKey, key: string): Array<{ key: string; label: string }> {
  const generated = (LOOKUP_OPTIONS as Record<string, Record<string, Array<{ key: string; label: string }>>>)[entity]?.[key];
  if (generated && generated.length) return generated.map(o => ({ key: o.key, label: o.label }));
  const keys = ruleOf(entity, key)?.options ?? [];
  return keys.map(k => ({ key: k, label: lookupLabel(entity, key, k) ?? k }));
}

export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object)) {
    const r = v as { from: unknown; to: unknown };
    return isEmptyValue(r.from) && isEmptyValue(r.to);
  }
  return false;
}
