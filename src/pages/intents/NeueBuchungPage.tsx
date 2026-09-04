/**
 * Neue Buchung — 3-Schritt-Wizard.
 * Steps: 1) Zimmer wählen → 2) Reisezeitraum festlegen (Verfügbarkeitsprüfung) → 3) Gästdaten eingeben.
 * Reads: buchungen (für Belegung), zimmer (via useRecordSearch).
 * Writes: buchungen (createBuchungenEntry via useJourneySubmit).
 * Composes: IntentWizardShell, EntitySelectStep, AvailabilityRangePicker, Field, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { Field } from '@/components/blocks/Field';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  occupancyFor,
  fieldLookup,
  fieldNumber,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { useDashboardData } from '@/hooks/useDashboardData';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';

export default function NeueBuchungPage() {
  const data = useDashboardData({ omit: ['zimmer'] });
  const buchungen = data.buchungen ?? [];

  const zimmer = useRecordSearch(servicePort, 'zimmer', {
    searchFields: [],
    toItem: z => ({
      id: z.id,
      title: fieldNumber(z, 'zimmernummer') != null
        ? tx`Zimmer ${String(fieldNumber(z, 'zimmernummer'))}`
        : tx('Zimmer'),
      subtitle: fieldLookup(z, 'zimmertyp')?.label ?? undefined,
      stats: [
        {
          label: tx('Preis/Nacht'),
          value: fieldNumber(z, 'preis_pro_nacht') != null
            ? `${fieldNumber(z, 'preis_pro_nacht')} €`
            : '—',
        },
        {
          label: tx('Max. Personen'),
          value: String(fieldNumber(z, 'max_personen') ?? '—'),
        },
      ],
    }),
  });

  const [step, setStep] = useState(1);

  const buchungForm = useStepForm('buchungen', {
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
    messages: {
      zimmer: tx('Bitte ein Zimmer für diese Buchung wählen.'),
      anreisedatum: tx('Bitte einen Anreisezeitraum wählen.'),
      abreisedatum: tx('Bitte einen Abreisezeitraum wählen.'),
    },
  });

  const selectedZimmerId = buchungForm.get('zimmer') as string | undefined;
  const blocked = occupancyFor('buchungen', buchungen, { resource: selectedZimmerId ?? null });

  const submit = useJourneySubmit(servicePort, [
    {
      key: 'buchung',
      entity: 'buchungen',
      form: buchungForm,
      primary: true,
      values: { status: 'anfrage' },
    },
  ], { draftKey: 'neue-buchung' });

  const restart = () => { submit.reset(); buchungForm.reset(); setStep(1); };

  const selectedZimmerRecord = selectedZimmerId ? zimmer.recordOf(selectedZimmerId) : undefined;
  const zimmerLabel = selectedZimmerId ? zimmer.labelOf(selectedZimmerId) : '';

  const anreise = buchungForm.get('anreisedatum') as string | undefined;
  const abreise = buchungForm.get('abreisedatum') as string | undefined;

  return (
    <IntentWizardShell
      title={tx('Neue Buchung anlegen')}
      currentStep={step}
      onStepChange={setStep}
      loading={data.loading}
      error={data.error}
      onRetry={data.fetchAll}
      forms={[buchungForm]}
      draftKey="neue-buchung"
      intro={{
        description: tx('Zimmer für einen Gast reservieren und Buchung als Anfrage anlegen.'),
        needs: [tx('Zimmerwahl'), tx('An- und Abreisedatum'), tx('Name und Kontakt des Gastes')],
      }}
    >
      {/* Schritt 1: Zimmer wählen */}
      <WizardStep
        label={tx('Zimmer')}
        description={tx('Das Zimmer für diese Buchung auswählen.')}
      >
        <EntitySelectStep
          {...zimmer.select}
          selectedId={selectedZimmerId}
          onSelect={id => {
            buchungForm.set('zimmer', id, zimmer.labelOf(id));
            setStep(2);
          }}
          emptyText={tx('Keine Zimmer gefunden.')}
        />
      </WizardStep>

      {/* Schritt 2: Reisezeitraum */}
      <WizardStep
        label={tx('Zeitraum')}
        description={tx('An- und Abreise wählen — belegte Nächte sind ausgegraut.')}
      >
        {selectedZimmerId ? (
          <div className="space-y-4">
            {selectedZimmerRecord && (
              <div className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{zimmerLabel}</span>
                {fieldLookup(selectedZimmerRecord, 'zimmertyp') && (
                  <span className="ml-2">{fieldLookup(selectedZimmerRecord, 'zimmertyp')?.label}</span>
                )}
                {fieldNumber(selectedZimmerRecord, 'preis_pro_nacht') != null && (
                  <span className="ml-2">· {fieldNumber(selectedZimmerRecord, 'preis_pro_nacht')} {tx('€/Nacht')}</span>
                )}
              </div>
            )}
            <AvailabilityRangePicker
              {...buchungForm.range('anreisedatum', 'abreisedatum', { blocked })}
              disablePast
              legend={tx('Belegt')}
            />
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => buchungForm.validate(['anreisedatum', 'abreisedatum'])}
              nextStepLabel={tx('Gästdaten')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Bitte zuerst ein Zimmer wählen.')}
          </StepNav>
        )}
      </WizardStep>

      {/* Schritt 3: Gästdaten */}
      <WizardStep
        label={tx('Gästdaten')}
        description={tx('Kontaktdaten und Anzahl der Personen des Gastes erfassen.')}
      >
        {selectedZimmerId && anreise && abreise ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field form={buchungForm} name="vorname">
                <Input
                  {...buchungForm.field('vorname')}
                  placeholder={tx('Vorname des Gastes')}
                />
              </Field>
              <Field form={buchungForm} name="nachname">
                <Input
                  {...buchungForm.field('nachname')}
                  placeholder={tx('Nachname des Gastes')}
                />
              </Field>
            </div>
            <Field form={buchungForm} name="email">
              <Input
                {...buchungForm.field('email')}
                placeholder={tx('email@beispiel.de')}
              />
            </Field>
            <Field form={buchungForm} name="telefon">
              <Input
                {...buchungForm.field('telefon')}
                placeholder={tx('+49 123 456789')}
              />
            </Field>
            <Field form={buchungForm} name="anzahl_personen">
              <Input
                {...buchungForm.number('anzahl_personen')}
                placeholder="1"
              />
            </Field>
            <Field form={buchungForm} name="nachricht">
              <Textarea
                {...buchungForm.field('nachricht')}
                rows={3}
                placeholder={tx('Besondere Wünsche oder Anmerkungen …')}
              />
            </Field>
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => buchungForm.validate(['vorname', 'nachname', 'email', 'anzahl_personen'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(selectedZimmerId ? 2 : 1)} nextDisabled>
            {tx('Bitte zuerst Zimmer und Zeitraum auswählen.')}
          </StepNav>
        )}
      </WizardStep>

      {/* Schritt 4: Prüfen & Absenden */}
      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[buchungForm]}
            submit={submit}
            whatHappensNext={tx('Die Buchung wird als Anfrage angelegt und kann anschließend bestätigt oder abgelehnt werden.')}
            items={
              anreise && abreise
                ? [{
                    key: '_zeitraum',
                    label: tx('Zeitraum'),
                    value: `${formatDate(anreise)} – ${formatDate(abreise)}`,
                    keys: ['anreisedatum', 'abreisedatum'],
                    fieldId: buchungForm.fieldId('anreisedatum'),
                  }]
                : []
            }
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[buchungForm]}
          next={[
            { label: tx('Weitere Buchung anlegen'), onClick: restart },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Die Buchung erscheint in der Übersicht und kann dort bearbeitet werden.')}
        />
      )}
    </IntentWizardShell>
  );
}
