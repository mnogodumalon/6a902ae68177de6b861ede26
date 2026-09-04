import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, isBefore, isToday } from 'date-fns';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { Button } from '@/components/ui/button';
import {
  ResourceTimeline,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';
import {
  IconBed,
  IconPlus,
  IconAlertTriangle,
  IconCalendar,
  IconCheck,
  IconDoor,
} from '@tabler/icons-react';

const EVENT_PREFIX = 'buchung';
function buchungIdOf(id: string): string {
  return id.split(':')[1] ?? '';
}

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { zimmer, buchungen, setBuchungen, fetchAll } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type !== 'buchungen') return undefined;
      const b = top.record;
      const status = b.fields.status?.key;
      if (status === 'anfrage') {
        return {
          label: tx('Bestätigen'),
          onClick: () => advanceStatus(b, 'bestaetigt'),
        };
      }
      if (status === 'bestaetigt') {
        return {
          label: tx('Check-in durchführen'),
          onClick: () => advanceStatus(b, 'eingecheckt'),
        };
      }
      if (status === 'eingecheckt') {
        return {
          label: tx('Check-out durchführen'),
          onClick: () => advanceStatus(b, 'ausgecheckt'),
        };
      }
      return undefined;
    },
  });

  const enrichedBuchungen = crud.enriched.buchungen;
  const clock = useClock();

  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const advanceStatus = useCallback(async (b: typeof buchungen[0], newStatus: string) => {
    const prev = b.fields.status;
    const newLv = lookupOption('buchungen', 'status', newStatus);
    setBuchungen(prev2 => prev2.map(x => x.record_id === b.record_id
      ? { ...x, fields: { ...x.fields, status: newLv } }
      : x
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(b.record_id, { status: newStatus });
      undoToast(tx`${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''} — ${newLv.label}`, async () => {
        setBuchungen(prev2 => prev2.map(x => x.record_id === b.record_id
          ? { ...x, fields: { ...x.fields, status: prev } }
          : x
        ));
        await LivingAppsService.updateBuchungenEntry(b.record_id, { status: prev?.key ?? '' });
      });
    } catch {
      fetchAll();
    }
  }, [setBuchungen, fetchAll]);

  const today = format(clock, 'yyyy-MM-dd');

  // Groups = Zimmer als Ressource-Zeilen
  const groups = useMemo<ResourceGroup[]>(
    () => zimmer
      .sort((a, b) => (a.fields.zimmernummer ?? 0) - (b.fields.zimmernummer ?? 0))
      .map(z => ({
        key: z.record_id,
        label: z.fields.zimmernummer
          ? `${tx('Zimmer')} ${z.fields.zimmernummer}${z.fields.zimmertyp ? ' · ' + z.fields.zimmertyp.label : ''}`
          : z.record_id,
      })),
    [zimmer],
  );

  // Events = Buchungen als Balken
  const events = useMemo<ResourceEvent[]>(
    () =>
      buchungen
        .filter(b => !!b.fields.anreisedatum && b.fields.status?.key !== 'storniert' && b.fields.status?.key !== 'abgelehnt')
        .map(b => {
          const status = b.fields.status?.key;
          const tone: ResourceEvent['tone'] =
            status === 'anfrage' ? 'warning'
            : status === 'bestaetigt' ? 'primary'
            : status === 'eingecheckt' ? 'success'
            : 'default';
          return {
            id: `${EVENT_PREFIX}:${b.record_id}`,
            start: b.fields.anreisedatum!,
            end: b.fields.abreisedatum,
            allDay: true,
            title: `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim() || tx('Gast'),
            subtitle: b.fields.status?.label,
            tone,
            group: extractRecordId(b.fields.zimmer) ?? '',
          };
        }),
    [buchungen],
  );

  // Belegungsrate für diesen Monat pro Zimmer
  const occupancyByRoom = useMemo(() => {
    const start = startOfMonth(clock);
    const end = endOfMonth(clock);
    const daysInMonth = end.getDate();
    const counts = new Map<string, number>();
    for (const b of buchungen) {
      if (b.fields.status?.key === 'storniert' || b.fields.status?.key === 'abgelehnt') continue;
      const roomId = extractRecordId(b.fields.zimmer);
      if (!roomId || !b.fields.anreisedatum) continue;
      const from = parseISO(b.fields.anreisedatum);
      const to = b.fields.abreisedatum ? parseISO(b.fields.abreisedatum) : from;
      let occupied = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (isWithinInterval(d, { start: from, end: to })) occupied += 1;
      }
      counts.set(roomId, (counts.get(roomId) ?? 0) + occupied);
    }
    const pct = new Map<string, number>();
    for (const [roomId, occ] of counts) {
      pct.set(roomId, Math.round((occ / daysInMonth) * 100));
    }
    return pct;
  }, [buchungen, clock]);

  // KPI-Berechnungen
  const anfragen = useMemo(() => buchungen.filter(b => b.fields.status?.key === 'anfrage'), [buchungen]);
  const heuteCheckIn = useMemo(() => buchungen.filter(b => b.fields.anreisedatum === today && b.fields.status?.key === 'bestaetigt'), [buchungen, today]);
  const heuteCheckOut = useMemo(() => buchungen.filter(b => b.fields.abreisedatum === today && b.fields.status?.key === 'eingecheckt'), [buchungen, today]);
  const eingecheckt = useMemo(() => buchungen.filter(b => b.fields.status?.key === 'eingecheckt'), [buchungen]);

  // Überfällige Anfragen (älter als 2 Tage ohne Bestätigung)
  const ueberfaelligeAnfragen = useMemo(() => anfragen.filter(b => {
    const anreise = b.fields.anreisedatum;
    if (!anreise) return false;
    return isBefore(parseISO(anreise), clock);
  }), [anfragen, clock]);

  // Context-Zeile
  const contextLine = useMemo(() => {
    const parts: string[] = [];
    if (heuteCheckIn.length > 0) {
      const namen2 = namen(heuteCheckIn.map(b => `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim()));
      parts.push(`${tx('Heute Anreise')}: ${namen2}`);
    }
    if (heuteCheckOut.length > 0) {
      const namen2 = namen(heuteCheckOut.map(b => `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim()));
      parts.push(`${tx('Abreise')}: ${namen2}`);
    }
    if (parts.length === 0 && eingecheckt.length === 0) {
      return tx('Keine Belegung heute — ein ruhiger Tag.');
    }
    if (parts.length === 0 && eingecheckt.length > 0) {
      return `${eingecheckt.length} ${tx('Gäste eingecheckt')}`;
    }
    return parts.join(' · ');
  }, [heuteCheckIn, heuteCheckOut, eingecheckt]);

  // Drag: Buchung verschieben / Zimmer wechseln
  const handleEventDrop = useCallback(async (id: string, newStart: string, newEnd?: string, newGroup?: string) => {
    const rid = buchungIdOf(id);
    if (!rid) return;
    const b = buchungen.find(x => x.record_id === rid);
    if (!b) return;
    const prevAnreise = b.fields.anreisedatum;
    const prevAbreise = b.fields.abreisedatum;
    const prevZimmer = b.fields.zimmer;
    const zimmerPatch = newGroup ? { zimmer: createRecordUrl(APP_IDS.ZIMMER, newGroup) } : {};
    setBuchungen(prev => prev.map(x =>
      x.record_id === rid
        ? { ...x, fields: { ...x.fields, anreisedatum: newStart, ...(newEnd ? { abreisedatum: newEnd } : {}), ...zimmerPatch } }
        : x
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(rid, {
        anreisedatum: newStart,
        ...(newEnd ? { abreisedatum: newEnd } : {}),
        ...zimmerPatch,
      });
      undoToast(tx`Buchung verschoben`, async () => {
        setBuchungen(prev => prev.map(x =>
          x.record_id === rid
            ? { ...x, fields: { ...x.fields, anreisedatum: prevAnreise, abreisedatum: prevAbreise, zimmer: prevZimmer } }
            : x
        ));
        await LivingAppsService.updateBuchungenEntry(rid, {
          anreisedatum: prevAnreise,
          abreisedatum: prevAbreise,
          ...(prevZimmer ? { zimmer: prevZimmer } : {}),
        });
      });
    } catch {
      fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  // Drag-Resize: Abreisedatum anpassen
  const handleEventResize = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const rid = buchungIdOf(id);
    if (!rid) return;
    const b = buchungen.find(x => x.record_id === rid);
    if (!b) return;
    const prevAnreise = b.fields.anreisedatum;
    const prevAbreise = b.fields.abreisedatum;
    setBuchungen(prev => prev.map(x =>
      x.record_id === rid
        ? { ...x, fields: { ...x.fields, anreisedatum: newStart, abreisedatum: newEnd } }
        : x
    ));
    try {
      await LivingAppsService.updateBuchungenEntry(rid, { anreisedatum: newStart, abreisedatum: newEnd });
      undoToast(tx`Aufenthalt angepasst`, async () => {
        setBuchungen(prev => prev.map(x =>
          x.record_id === rid
            ? { ...x, fields: { ...x.fields, anreisedatum: prevAnreise, abreisedatum: prevAbreise } }
            : x
        ));
        await LivingAppsService.updateBuchungenEntry(rid, { anreisedatum: prevAnreise, abreisedatum: prevAbreise });
      });
    } catch {
      fetchAll();
    }
  }, [buchungen, setBuchungen, fetchAll]);

  // WorkList-Items für heute
  const workItems = useMemo(() => {
    const items = [
      ...heuteCheckIn.map(b => ({
        id: b.record_id,
        title: `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim() || tx('Gast'),
        secondLine: (
          <span className="text-primary font-medium">
            {tx('Anreise')} · {b.fields.anzahl_personen ? `${b.fields.anzahl_personen} ${tx('Pers.')}` : ''} · {enrichedBuchungen.find(e => e.record_id === b.record_id)?.zimmerName ?? ''}
          </span>
        ),
        action: {
          label: tx('Check-in'),
          onClick: () => advanceStatus(b, 'eingecheckt'),
        },
      })),
      ...heuteCheckOut.map(b => ({
        id: b.record_id,
        title: `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim() || tx('Gast'),
        secondLine: (
          <span className="text-amber-600 font-medium">
            {tx('Abreise')} · {enrichedBuchungen.find(e => e.record_id === b.record_id)?.zimmerName ?? ''}
          </span>
        ),
        action: {
          label: tx('Check-out'),
          onClick: () => advanceStatus(b, 'ausgecheckt'),
        },
      })),
    ];
    return items;
  }, [heuteCheckIn, heuteCheckOut, enrichedBuchungen, advanceStatus]);

  // WorkList für offene Anfragen
  const anfrageItems = useMemo(() =>
    anfragen.slice(0, 6).map(b => {
      const enriched = enrichedBuchungen.find(e => e.record_id === b.record_id);
      return {
        id: b.record_id,
        title: `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim() || tx('Gast'),
        secondLine: (
          <span className="text-muted-foreground">
            {enriched?.zimmerName ?? ''} · {formatDate(b.fields.anreisedatum)} – {formatDate(b.fields.abreisedatum)}
          </span>
        ),
        action: {
          label: tx('Bestätigen'),
          onClick: () => advanceStatus(b, 'bestaetigt'),
        },
      };
    }),
  [anfragen, enrichedBuchungen, advanceStatus]);

  const statusOptions = LOOKUP_OPTIONS['buchungen']?.['status'] ?? [];
  const filteredBuchungen = filterStatus
    ? buchungen.filter(b => b.fields.status?.key === filterStatus)
    : buchungen;

  return (
    <div className="space-y-6">
      {/* Seiten-Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <Button onClick={() => crud.buchungen.openCreate({})} className="shrink-0">
          <IconPlus size={16} className="mr-2 shrink-0" />
          {tx('Neue Buchung')}
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={ueberfaelligeAnfragen.length > 0 ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: tx('Jetzt bestätigen'),
              onClick: () => advanceStatus(ueberfaelligeAnfragen[0], 'bestaetigt'),
            }}
          >
            <b>{namen(ueberfaelligeAnfragen.map(b => `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim()))}</b>
            {' '}{ueberfaelligeAnfragen.length === 1 ? tx('wartet auf Bestätigung') : tx('warten auf Bestätigung')} —{' '}
            {tx('Anreise')} {formatDate(ueberfaelligeAnfragen[0].fields.anreisedatum)}
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Anfragen')}
              value={anfragen.length}
              icon={<IconCalendar size={16} className="shrink-0" />}
              tone={anfragen.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilterStatus(f => f === 'anfrage' ? null : 'anfrage')}
              active={filterStatus === 'anfrage'}
            />
            <StatStripItem
              title={tx('Heute Anreise')}
              value={heuteCheckIn.length}
              icon={<IconDoor size={16} className="shrink-0" />}
              tone={heuteCheckIn.length > 0 ? 'primary' : 'default'}
              onClick={() => setFilterStatus(f => f === 'bestaetigt' ? null : 'bestaetigt')}
              active={filterStatus === 'bestaetigt'}
            />
            <StatStripItem
              title={tx('Eingecheckt')}
              value={eingecheckt.length}
              icon={<IconBed size={16} className="shrink-0" />}
              tone={eingecheckt.length > 0 ? 'success' : 'default'}
              onClick={() => setFilterStatus(f => f === 'eingecheckt' ? null : 'eingecheckt')}
              active={filterStatus === 'eingecheckt'}
            />
            <StatStripItem
              title={tx('Heute Abreise')}
              value={heuteCheckOut.length}
              icon={<IconCheck size={16} className="shrink-0" />}
              tone={heuteCheckOut.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilterStatus(f => f === 'ausgecheckt' ? null : 'ausgecheckt')}
              active={filterStatus === 'ausgecheckt'}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            events={filterStatus ? events.filter(ev => {
              const rid = buchungIdOf(ev.id);
              const b = buchungen.find(x => x.record_id === rid);
              return b?.fields.status?.key === filterStatus;
            }) : events}
            groups={groups}
            axis="day"
            defaultRange="week"
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rid = buchungIdOf(ev.id);
              const b = buchungen.find(x => x.record_id === rid);
              if (b) crud.buchungen.openDetail(b);
            }}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onRangeCreate={(start, end, group) => {
              crud.buchungen.openCreate({
                anreisedatum: format(start, 'yyyy-MM-dd'),
                abreisedatum: format(end, 'yyyy-MM-dd'),
                ...(group ? { zimmer: createRecordUrl(APP_IDS.ZIMMER, group) } : {}),
              });
            }}
            onEmptyClick={(date, group) => {
              crud.buchungen.openCreate({
                anreisedatum: format(date, 'yyyy-MM-dd'),
                ...(group ? { zimmer: createRecordUrl(APP_IDS.ZIMMER, group) } : {}),
              });
            }}
            renderGroupHeader={group => {
              const z = zimmer.find(x => x.record_id === group.key);
              const pct = occupancyByRoom.get(group.key);
              return (
                <div
                  className="flex w-full items-center justify-between gap-1 cursor-pointer"
                  onClick={() => z && crud.zimmer.openDetail(z)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && z && crud.zimmer.openDetail(z)}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {z?.fields.zimmernummer ? `${tx('Zi.')} ${z.fields.zimmernummer}` : group.label}
                    </div>
                    {z?.fields.zimmertyp && (
                      <div className="truncate text-[11px] text-muted-foreground">{z.fields.zimmertyp.label}</div>
                    )}
                  </div>
                  {pct !== undefined && (
                    <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums">
                      {pct}%
                    </span>
                  )}
                </div>
              );
            }}
            renderEvent={ev => {
              const rid = buchungIdOf(ev.id);
              const b = buchungen.find(x => x.record_id === rid);
              const status = b?.fields.status?.key;
              return (
                <div className="flex items-center gap-1 truncate text-xs">
                  <IconBed className="h-3 w-3 shrink-0" />
                  <span className="truncate">{ev.title}</span>
                  {status === 'anfrage' && (
                    <span className="shrink-0 rounded-sm bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">?</span>
                  )}
                </div>
              );
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute')}
              items={workItems}
              onItemClick={id => {
                const b = buchungen.find(x => x.record_id === id);
                if (b) crud.buchungen.openDetail(b);
              }}
              empty={{
                text: heuteCheckIn.length === 0 && heuteCheckOut.length === 0
                  ? tx('Heute keine An- oder Abreisen')
                  : tx('Alles erledigt'),
                action: { label: tx('Neue Buchung'), onClick: () => crud.buchungen.openCreate({}) },
              }}
            />
            <WorkList
              title={tx('Offene Anfragen')}
              items={anfrageItems}
              onItemClick={id => {
                const b = buchungen.find(x => x.record_id === id);
                if (b) crud.buchungen.openDetail(b);
              }}
              empty={{
                text: tx('Keine offenen Anfragen'),
                action: { label: tx('Zimmer verwalten'), onClick: () => crud.zimmer.openCreate({}) },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
