/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'zimmer'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.zimmer.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.zimmer.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.zimmer.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.zimmer              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   zimmer: zimmernummer, zimmertyp, preis_pro_nacht, max_personen, foto  ·  ← buchungen (list + contextual +)
 *   buchungen: zimmer, anreisedatum, abreisedatum, vorname, nachname, email, telefon, anzahl_personen, …  ·  → zimmer
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Zimmer, Buchungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichBuchungen } from '@/lib/enrich';
import type { EnrichedBuchungen } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { ZimmerDialog, type ZimmerDialogDefaults } from '@/components/dialogs/ZimmerDialog';
import { ZimmerDetails } from '@/components/details/ZimmerDetails';
import { BuchungenDialog, type BuchungenDialogDefaults } from '@/components/dialogs/BuchungenDialog';
import { BuchungenDetails } from '@/components/details/BuchungenDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'zimmer'; record: Zimmer }
  | { type: 'buchungen'; record: EnrichedBuchungen };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  zimmer: EntityCrudApi<Zimmer, ZimmerDialogDefaults>;
  buchungen: EntityCrudApi<Buchungen, BuchungenDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { zimmer: Zimmer[]; buchungen: EnrichedBuchungen[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [zimmerDialog, setZimmerDialog] = useState<{ defaults?: ZimmerDialogDefaults; editing?: Zimmer } | null>(null);
  const [buchungenDialog, setBuchungenDialog] = useState<{ defaults?: BuchungenDialogDefaults; editing?: Buchungen } | null>(null);
  const enrichedBuchungen = useMemo(() => enrichBuchungen(data.buchungen, { zimmerMap: data.zimmerMap }), [data.buchungen, data.zimmerMap]);

  function detailZimmer(record: Zimmer, push = false) {
    const item: OverlayItem = { type: 'zimmer', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitZimmer(fields: Zimmer['fields']) {
    const editing = zimmerDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setZimmer(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateZimmerEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('zimmer')} — ${t('crud_updated')}`, async () => {
        data.setZimmer(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateZimmerEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createZimmerEntry(fields);
      undoToast(`${appLabel('zimmer')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailBuchungen(record: Buchungen, push = false) {
    const rec = enrichedBuchungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'buchungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitBuchungen(fields: Buchungen['fields']) {
    const editing = buchungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setBuchungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateBuchungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('buchungen')} — ${t('crud_updated')}`, async () => {
        data.setBuchungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateBuchungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createBuchungenEntry(fields);
      undoToast(`${appLabel('buchungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <ZimmerDialog
        open={zimmerDialog !== null}
        onClose={() => setZimmerDialog(null)}
        onSubmit={submitZimmer}
        defaultValues={zimmerDialog?.defaults}
        recordId={zimmerDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Zimmer']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Zimmer']}
      />
      <BuchungenDialog
        open={buchungenDialog !== null}
        onClose={() => setBuchungenDialog(null)}
        onSubmit={submitBuchungen}
        defaultValues={buchungenDialog?.defaults}
        recordId={buchungenDialog?.editing?.record_id}
        zimmerList={data.zimmer}
        enablePhotoScan={AI_PHOTO_SCAN['Buchungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Buchungen']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'zimmer') {
            return (
              <>
                <RecordHeader title={appLabel('zimmer')} subtitle={undefined} />
                <ZimmerDetails
                  record={top.record}
                  buchungenList={data.buchungen}
                  onOpenBuchungen={(r) => detailBuchungen(r, true)}
                  onAddBuchungen={() => setBuchungenDialog({ defaults: { zimmer: createRecordUrl(APP_IDS.ZIMMER, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'buchungen') {
            return (
              <>
                <RecordHeader title={top.record.fields.vorname ?? appLabel('buchungen')} subtitle={top.record.fields.anreisedatum ? formatDate(top.record.fields.anreisedatum) : undefined} />
                <BuchungenDetails
                  record={top.record}
                  zimmerList={data.zimmer}
                  onOpenZimmer={(r) => detailZimmer(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'zimmer') setZimmerDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'buchungen') setBuchungenDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    zimmer: {
      openCreate: (defaults?: ZimmerDialogDefaults) => setZimmerDialog({ defaults }),
      openEdit: (record: Zimmer) => setZimmerDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Zimmer) => detailZimmer(record, false),
    },
    buchungen: {
      openCreate: (defaults?: BuchungenDialogDefaults) => setBuchungenDialog({ defaults }),
      openEdit: (record: Buchungen) => setBuchungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Buchungen) => detailBuchungen(record, false),
    },
    enriched: { zimmer: data.zimmer, buchungen: enrichedBuchungen },
  };
}
