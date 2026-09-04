/**
 * Buchung-Status ändern — 2-Schritt-Wizard.
 * Steps: 1) Buchung wählen (nur anfrage|bestaetigt|eingecheckt) → 2) Neuer Status wählen → Prüfen & aktualisieren.
 * Reads: buchungen. Writes: buchungen (updateBuchungenEntry — run step).
 * Composes: IntentWizardShell, EntitySelectStep, ChoiceGroup, StepNav, SummaryStep, SuccessStep, StatusBadge.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, fieldLookup } from '@/lib/journey';
import { Field } from '@/components/blocks/Field';
import { servicePort } from '@/services/journeyPort';
import { useDashboardData } from '@/hooks/useDashboardData';
import { formatDate } from '@/lib/formatters';
import { LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';
import { LivingAppsService } from '@/services/livingAppsService';

export default function BuchungStatusPage() {
  const data = useDashboardData({ omit: ['buchungen'] });

  const buchungen = useRecordSearch(servicePort, 'buchungen', {
    filter: "(r.v_status == 'anfrage') or (r.v_status == 'bestaetigt') or (r.v_status == 'eingecheckt')",
    where: r => {
      const key = fieldLookup(r, 'status')?.key;
      return key !== 'storniert' && key !== 'abgelehnt' && key !== 'ausgecheckt';
    },
    searchFields: ['vorname', 'nachname'],
    toItem: r => {
      const vorname = fieldText(r, 'vorname') ?? '';
      const nachname = fieldText(r, 'nachname') ?? '';
      const status = fieldLookup(r, 'status') ?? undefined;
      const anreise = fieldText(r, 'anreisedatum');
      return {
        id: r.id,
        title: `${vorname} ${nachname}`.trim() || tx('(Kein Name)'),
        subtitle: anreise ? `${tx('Anreise')}: ${formatDate(anreise)}` : undefined,
        status,
      };
    },
  });

  const [step, setStep] = useState(1);

  // Step 1: Buchung-Auswahl (kein Formular nötig — nur ein Record-Pick)
  const [selectedBuchungId, setSelectedBuchungId] = useState<string>('');
  const [zimmerName, setZimmerName] = useState<string>('');

  // Step 2: Neuer Status
  const statusForm = useStepForm('buchungen', {
    steps: { status: 2 },
  });

  // Update-only flow: run-Schritt ohne form, der das Buchungs-record aktualisiert
  const submit = useJourneySubmit(servicePort, [
    {
      key: 'buchung',
      run: async () => {
        return LivingAppsService.updateBuchungenEntry(selectedBuchungId, {
          status: statusForm.get('status') as string,
        });
      },
      verb: 'update' as const,
    },
  ], { draftKey: 'buchung-status' });

  const restart = () => {
    submit.reset();
    statusForm.reset();
    setSelectedBuchungId('');
    setZimmerName('');
    setStep(1);
  };

  // Erlaubte Status-Übergänge basierend auf dem aktuellen Status der gewählten Buchung
  const selectedRec = selectedBuchungId ? buchungen.recordOf(selectedBuchungId) : undefined;
  const currentStatusKey = selectedRec ? fieldLookup(selectedRec, 'status')?.key : undefined;

  // Alle verfügbaren Status-Optionen aus dem Schema
  const allStatusOptions = LOOKUP_OPTIONS['buchungen']?.['status'] ?? [];

  // Hinweis-Text für logische Übergänge (weiche Empfehlung, keine harte Sperre)
  const transitionHint = (() => {
    if (currentStatusKey === 'anfrage') return tx('Empfohlen: Bestätigen oder Ablehnen');
    if (currentStatusKey === 'bestaetigt') return tx('Empfohlen: Einchecken oder Stornieren');
    if (currentStatusKey === 'eingecheckt') return tx('Empfohlen: Auschecken');
    return undefined;
  })();

  // Gästename und zimmerName aus dem gewählten Record
  const selectedRecord = selectedBuchungId
    ? buchungen.select.items.find(i => i.id === selectedBuchungId)
    : undefined;

  const gastName = selectedRecord?.title ?? '';

  return (
    <IntentWizardShell
      title={tx('Buchungsstatus ändern')}
      currentStep={step}
      onStepChange={setStep}
      loading={data.loading}
      error={data.error}
      onRetry={data.fetchAll}
      forms={[statusForm]}
      draftKey="buchung-status"
      intro={{
        description: tx('Offene Buchung auswählen und in den nächsten Status überführen.'),
        needs: [tx('Gastname oder Buchungsnummer'), tx('Neuer Status')],
      }}
    >
      <WizardStep
        label={tx('Buchung')}
        description={tx('Nur aktive Buchungen (Anfrage, Bestätigt, Eingecheckt) werden angezeigt.')}
      >
        <EntitySelectStep
          {...buchungen.select}
          selectedId={selectedBuchungId}
          onSelect={id => {
            setSelectedBuchungId(id);
            // zimmerName aus EnrichedBuchungen: hier über den record-Titel approximiert
            const rec = buchungen.select.items.find(i => i.id === id);
            setZimmerName(rec?.subtitle ?? '');
            setStep(2);
          }}
          searchPlaceholder={tx('Nach Gast suchen …')}
          emptyText={tx('Keine offenen Buchungen gefunden')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Status')}
        description={transitionHint ?? tx('Neuen Status für diese Buchung wählen.')}
      >
        {selectedBuchungId ? (
          <div className="space-y-4">
            {/* Kontext-Karte: aktuelle Buchung */}
            <div className="rounded-2xl border bg-card p-4 space-y-1">
              <p className="font-medium">{gastName}</p>
              {zimmerName && <p className="text-sm text-muted-foreground">{zimmerName}</p>}
              {currentStatusKey && (
                <div className="pt-1">
                  <StatusBadge
                    statusKey={currentStatusKey}
                    label={allStatusOptions.find(o => o.key === currentStatusKey)?.label ?? currentStatusKey}
                  />
                </div>
              )}
            </div>

            {/* Status-Auswahl */}
            <Field form={statusForm} name="status">
              <ChoiceGroup
                {...statusForm.choice('status')}
                options={allStatusOptions.map(o => ({ key: o.key, label: o.label }))}
              />
            </Field>

            <StepNav
              onNext={() => statusForm.validate(['status'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Bitte zuerst eine Buchung in Schritt 1 auswählen.')}
          </StepNav>
        )}
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && selectedBuchungId ? (
          <SummaryStep
            forms={[statusForm]}
            submit={submit}
            items={[
              {
                key: 'gast',
                label: tx('Gast'),
                value: gastName,
                keys: ['_buchungId'],
                fieldId: '_buchungId',
              },
              ...(zimmerName ? [{
                key: 'zimmer',
                label: tx('Zimmer'),
                value: zimmerName,
                keys: ['_buchungId'],
                fieldId: '_zimmer',
              }] : []),
            ]}
            whatHappensNext={tx('Die Statusänderung ist sofort wirksam und in der Buchungsübersicht sichtbar.')}
            confirmLabel={tx('Status aktualisieren')}
          />
        ) : !selectedBuchungId ? (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Bitte zuerst eine Buchung in Schritt 1 auswählen.')}
          </StepNav>
        ) : null}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[statusForm]}
          title={tx('Status aktualisiert')}
          next={[
            { label: tx('Weiteren Status ändern'), onClick: restart },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Der Gast kann bei Bedarf direkt kontaktiert werden.')}
          actions={{ copy: false, print: false }}
        />
      )}
    </IntentWizardShell>
  );
}
