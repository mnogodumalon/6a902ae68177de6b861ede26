import type { Buchungen, Zimmer } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface BuchungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Buchungen;
  /** N:1-Ziel „Zimmer": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  zimmerList: Zimmer[];
  /** Klick auf die Zimmer-Relation → overlay.push auf dessen Detail. */
  onOpenZimmer?: (record: Zimmer) => void;
}

export function BuchungenDetails({
  record,
  zimmerList,
  onOpenZimmer,
}: BuchungenDetailsProps) {
  const zimmerTarget = zimmerList.find(r => r.record_id === extractRecordId(record.fields.zimmer));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('buchungen', 'anreisedatum')} value={record.fields.anreisedatum} format="date" />
        <RecordField label={fieldLabel('buchungen', 'abreisedatum')} value={record.fields.abreisedatum} format="date" />
        <RecordField label={fieldLabel('buchungen', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('buchungen', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('buchungen', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('buchungen', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('buchungen', 'anzahl_personen')} value={record.fields.anzahl_personen} format="text" />
        <RecordField label={fieldLabel('buchungen', 'nachricht')} value={record.fields.nachricht} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('buchungen', 'status')} value={record.fields.status} format="pill" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('buchungen', 'zimmer')}
          name={zimmerTarget?.fields.zimmernummer ?? '—'}
          meta={undefined}
          onClick={zimmerTarget && onOpenZimmer ? () => onOpenZimmer!(zimmerTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.BUCHUNGEN} recordId={record.record_id} />
    </>
  );
}
