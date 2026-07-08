import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { SpeakerProfileFormDialog } from './SpeakerProfileFormDialog'
import type { SpeakerProfile } from '@/lib/types/podcasts'

/**
 * Bug #2 (isolated, backend-independent) — the "Advanced voice settings"
 * accordion must open automatically when the profile already has voice_settings.
 *
 * This is a pure component test: it feeds `initialData.voice_settings` directly,
 * so it does NOT depend on the persistence bug (Bug #1). It fails on the current
 * branch (the Collapsible has no defaultOpen logic) and passes once the accordion
 * opens when values are present.
 *
 * `useTranslation` is globally mocked in src/test/setup.ts (t returns the key),
 * so the accordion trigger renders as its i18n key text.
 */

const EL_MODEL = 'model:elevenlabs_test'

vi.mock('@/lib/hooks/use-models', () => ({
  useModels: () => ({
    data: [{ id: EL_MODEL, name: 'eleven_test', provider: 'elevenlabs', type: 'text_to_speech' }],
    isLoading: false,
  }),
}))

vi.mock('@/lib/hooks/use-podcasts', () => ({
  useCreateSpeakerProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateSpeakerProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

// ModelSelector pulls in data-fetching we don't need here; stub it.
vi.mock('@/components/common/ModelSelector', () => ({
  ModelSelector: ({ label }: { label?: string }) => <div>{label}</div>,
}))

const baseProfile: SpeakerProfile = {
  id: 'speaker_profile:test',
  name: 'Test Profile',
  description: '',
  voice_model: EL_MODEL,
  voice_settings: { stability: 0.42, similarity_boost: 0.75 },
  speakers: [
    { name: 'Alice', voice_id: 'voice_alice', backstory: 'b', personality: 'p' },
  ],
} as unknown as SpeakerProfile

describe('SpeakerProfileFormDialog — advanced voice settings accordion', () => {
  const noop = vi.fn()

  it('renders the accordion trigger for an ElevenLabs profile', () => {
    render(
      <SpeakerProfileFormDialog
        mode="edit"
        open
        onOpenChange={noop}
        initialData={baseProfile}
      />
    )
    // Trigger text is the i18n key (t returns keys under test).
    expect(
      screen.getAllByText('podcasts.advancedVoiceSettings').length
    ).toBeGreaterThan(0)
  })

  it('opens the accordion automatically when voice_settings are defined (Bug #2)', () => {
    render(
      <SpeakerProfileFormDialog
        mode="edit"
        open
        onOpenChange={noop}
        initialData={baseProfile}
      />
    )

    const trigger = screen
      .getAllByText('podcasts.advancedVoiceSettings')[0]
      .closest('button')
    expect(trigger).not.toBeNull()
    // The profile has saved settings, so the accordion must be expanded.
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    // ...and the saved stability value must be visible.
    expect(
      (screen.getByLabelText('podcasts.vsStability') as HTMLInputElement).value
    ).toBe('0.42')
  })
})
