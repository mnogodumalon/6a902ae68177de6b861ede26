import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
  type PublicRecordResult,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { useStepForm, useJourneySubmit } from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { EntitySelectStep, type SelectItem } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const SLUG = 'buchungsanfrage';

const ZIMMERTYP_LABELS: Record<string, string> = /* i18n-exempt */ {
  doppelzimmer: 'Doppelzimmer',
  familienzimmer: 'Familienzimmer',
  einzelzimmer: 'Einzelzimmer',
};

interface ZimmerRecord {
  id: string;
  zimmernummer: number | null;
  zimmertyp: string | null;
  preis_pro_nacht: number | null;
  max_personen: number | null;
}

interface BuchungLite {
  id: string;
  fields: Record<string, unknown>;
}

function parseZimmer(r: PublicRecordResult): ZimmerRecord {
  return {
    id: r.id,
    zimmernummer: (r.fields.zimmernummer as number) ?? null,
    zimmertyp: (r.fields.zimmertyp as string) ?? null,
    preis_pro_nacht: (r.fields.preis_pro_nacht as number) ?? null,
    max_personen: (r.fields.max_personen as number) ?? null,
  };
}

// Free statuses — nights from bookings in these states do NOT block
const FREE_STATUS_KEYS = new Set(['storniert', 'abgelehnt']);

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [zimmer, setZimmer] = useState<ZimmerRecord[]>([]);
  const [buchungen, setBuchungen] = useState<BuchungLite[]>([]);
  const [step, setStep] = useState(1);

  // ALL hooks before early returns
  const port = useMemo(
    () => (cfg && page ? createPublicPort(cfg, page) : null),
    [cfg, page],
  );

  const f = useStepForm('buchungen', {
    fields: ['zimmer', 'anreisedatum', 'abreisedatum', 'vorname', 'nachname', 'email', 'telefon', 'anzahl_personen', 'nachricht'],
    required: {
      zimmer: true,
      anreisedatum: true,
      abreisedatum: true,
      vorname: true,
      nachname: true,
      email: true,
      anzahl_personen: true,
    },
    steps: {
      zimmer: 1,
      anreisedatum: 2,
      abreisedatum: 2,
      vorname: 3,
      nachname: 3,
      email: 3,
      telefon: 3,
      anzahl_personen: 3,
      nachricht: 3,
    },
    autoComplete: true,
  });

  // useJourneySubmit called unconditionally — port is null until cfg loads,
  // but the hook itself must always be called (Rules of Hooks)
  const submit = useJourneySubmit(
    // When port is null, pass a dummy port that throws — submit.run() is only
    // called from SummaryStep which is only reachable when port is non-null.
    port ?? DUMMY_PORT,
    [{ key: 'anfrage', entity: 'buchungen', form: f, primary: true }],
    { draftKey: SLUG },
  );

  // Occupancy — manual because OCCUPANCY config is not set for buchungen
  const selectedZimmerId = f.get('zimmer') as string | null | undefined;

  const blocked = useMemo(() => {
    const FREE = FREE_STATUS_KEYS;
    return buchungen
      .filter(r => {
        // Filter by selected zimmer
        if (selectedZimmerId) {
          const zimmerRef = r.fields.zimmer;
          if (!zimmerRef) return false;
          const ref = String(zimmerRef);
          if (!ref.endsWith(`/${selectedZimmerId}`) && ref !== selectedZimmerId) return false;
        }
        // Exclude free statuses
        const statusVal = r.fields.status;
        const statusKey =
          statusVal && typeof statusVal === 'object' && 'key' in (statusVal as object)
            ? String((statusVal as { key: string }).key)
            : statusVal
              ? String(statusVal)
              : null;
        if (statusKey && FREE.has(statusKey)) return false;
        return true;
      })
      .map(r => ({
        start: String(r.fields.anreisedatum ?? '').slice(0, 10),
        end: r.fields.abreisedatum ? String(r.fields.abreisedatum).slice(0, 10) : null,
      }))
      .filter(b => b.start);
  }, [buchungen, selectedZimmerId]);

  const zimmerItems: SelectItem[] = useMemo(
    () =>
      zimmer.map(z => ({
        id: z.id,
        title: String(tx`Zimmer ${z.zimmernummer ?? '—'}`),
        subtitle: z.zimmertyp ? (ZIMMERTYP_LABELS[z.zimmertyp] ?? z.zimmertyp) : undefined,
        stats: [
          ...(z.preis_pro_nacht != null
            ? [{ label: tx('Preis/Nacht'), value: `${z.preis_pro_nacht} €` }]
            : []),
          ...(z.max_personen != null
            ? [{ label: tx('Max. Personen'), value: z.max_personen }]
            : []),
        ],
      })),
    [zimmer],
  );

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!cfg || !page) return;
    const zimmerEp = page.endpoints?.find(e => e.entity === 'zimmer' && e.op === 'list');
    const buchungenEp = page.endpoints?.find(e => e.entity === 'buchungen' && e.op === 'list');
    const loadZimmer = zimmerEp
      ? listPublicRecords(cfg, page, { appId: zimmerEp.app_id, limit: 500 })
      : Promise.resolve<Record<string, PublicRecordResult>>({});
    const loadBuchungen = buchungenEp
      ? listPublicRecords(cfg, page, { appId: buchungenEp.app_id, limit: 500 })
      : Promise.resolve<Record<string, PublicRecordResult>>({});
    Promise.all([loadZimmer, loadBuchungen]).then(([zm, bm]) => {
      setZimmer(Object.values(zm).map(parseZimmer));
      setBuchungen(Object.values(bm).map(r => ({ id: r.id, fields: r.fields as Record<string, unknown> })));
    });
  }, [cfg, page]);

  const restart = () => {
    f.reset();
    submit.reset();
    setStep(1);
  };

  // Early returns — AFTER all hooks
  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page) return <PublicShell unavailable />;

  const handleFirstInteraction = () => {
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep) prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  };

  return (
    <PublicShell
      title={tx('Zimmer anfragen')}
      description={tx('Wähle dein Zimmer und deine Reisedaten — wir melden uns per E-Mail.')}
      wide
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div onPointerDown={handleFirstInteraction} onFocus={handleFirstInteraction}>
        <IntentWizardShell
          currentStep={step}
          onStepChange={setStep}
          back={false}
          forms={[f]}
          draftKey={SLUG}
        >
          {/* Step 1: Zimmer wählen */}
          <WizardStep
            label={tx('Zimmer')}
            description={tx('Wähle das Zimmer aus, das du anfragen möchtest.')}
          >
            <EntitySelectStep
              items={zimmerItems}
              onSelect={id => {
                const z = zimmer.find(r => r.id === id);
                const label = z ? String(tx`Zimmer ${z.zimmernummer ?? ''}`) : id;
                f.set('zimmer', id, label);
              }}
              selectedId={f.get('zimmer') as string | null | undefined}
            />
            <StepNav
              onNext={() => f.validate(['zimmer'])}
              nextStepLabel={tx('Reisezeitraum')}
            />
          </WizardStep>

          {/* Step 2: Reisezeitraum */}
          <WizardStep
            label={tx('Reisezeitraum')}
            description={tx('Belegte Nächte sind ausgegraut und können nicht gewählt werden.')}
          >
            <AvailabilityRangePicker
              {...f.range('anreisedatum', 'abreisedatum', { blocked })}
              legend={tx('Belegte Nächte sind ausgegraut.')}
            />
            <StepNav
              onNext={() => f.validate(['anreisedatum', 'abreisedatum'])}
              nextStepLabel={tx('Kontaktdaten')}
            />
          </WizardStep>

          {/* Step 3: Kontaktdaten */}
          <WizardStep
            label={tx('Kontaktdaten')}
            description={tx('Deine Angaben werden nur für diese Anfrage verwendet.')}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field form={f} name="vorname">
                  <Input {...f.field('vorname')} />
                </Field>
                <Field form={f} name="nachname">
                  <Input {...f.field('nachname')} />
                </Field>
              </div>
              <Field form={f} name="email">
                <Input {...f.field('email')} />
              </Field>
              <Field form={f} name="telefon">
                <Input {...f.field('telefon')} />
              </Field>
              <Field form={f} name="anzahl_personen" hint={tx('Anzahl der Personen inklusive dir selbst')}>
                <Input {...f.number('anzahl_personen')} />
              </Field>
              <Field form={f} name="nachricht" hint={tx('Optionale Nachricht oder besondere Wünsche')}>
                <Textarea {...f.field('nachricht')} rows={3} />
              </Field>
            </div>
            <StepNav
              onNext={() => f.validate(['vorname', 'nachname', 'email', 'anzahl_personen'])}
              nextStepLabel={tx('Prüfen')}
            />
          </WizardStep>

          {/* Step 4: Zusammenfassung */}
          <WizardStep label={tx('Prüfen')}>
            {!submit.result && (
              <SummaryStep
                forms={[f]}
                submit={submit}
                whatHappensNext={tx('Wir prüfen deine Anfrage und melden uns innerhalb eines Werktages per E-Mail.')}
                confirmLabel={tx('Anfrage absenden')}
              />
            )}
          </WizardStep>

          {submit.result && (
            <SuccessStep
              result={submit.result}
              forms={[f]}
              whatHappensNext={tx('Wir melden uns per E-Mail. Bitte halte dein Postfach im Blick.')}
              next={[{ label: tx('Weitere Anfrage stellen'), onClick: restart }]}
            />
          )}
        </IntentWizardShell>
      </div>
    </PublicShell>
  );
}

// A port that always throws — used as a placeholder when cfg/page are not
// yet loaded so useJourneySubmit can be called unconditionally (Rules of Hooks).
// submit.run() is gated by SummaryStep which only renders when page is ready.
import type { JourneyPort } from '@/lib/journey';

const DUMMY_PORT: JourneyPort = {
  door: 'public',
  async list() { return []; },
  async count() { return null; },
  async get() { return null; },
  async create() { throw new Error(tx('Page not ready')); },
  ref() { return ''; },
};
