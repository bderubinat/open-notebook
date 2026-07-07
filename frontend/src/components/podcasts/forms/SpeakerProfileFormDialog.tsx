'use client'

import { useCallback, useEffect } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import type { FieldErrorsImpl, Control, FieldPath, UseFormRegister } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'

import { SpeakerProfile } from '@/lib/types/podcasts'
import type { VoiceSettings } from '@/lib/types/podcasts'
import {
  useCreateSpeakerProfile,
  useUpdateSpeakerProfile,
} from '@/lib/hooks/use-podcasts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ModelSelector } from '@/components/common/ModelSelector'
import { useModels } from '@/lib/hooks/use-models'

import type { TFunction } from 'i18next'
import { useTranslation } from '@/lib/hooks/use-translation'

const numberInput = {
  setValueAs: (v: unknown) => (v === '' || v == null ? undefined : Number(v)),
}

const cleanVoiceSettings = (vs?: VoiceSettings | null): VoiceSettings | null => {
  if (!vs) return null
  const entries = Object.entries(vs).filter(
    ([, v]) =>
      v !== undefined &&
      v !== null &&
      !(typeof v === 'number' && Number.isNaN(v))
  )
  return entries.length > 0 ? (Object.fromEntries(entries) as VoiceSettings) : null
}

const voiceSettingsSchema = (t: TFunction) => {
  const range01 = t('podcasts.vsRange01') || 'Must be between 0 and 1'
  const rangeSpeed = t('podcasts.vsRangeSpeed') || 'Must be between 0.7 and 1.2'
  return z
    .object({
      stability: z.number().min(0, range01).max(1, range01).optional(),
      similarity_boost: z.number().min(0, range01).max(1, range01).optional(),
      style: z.number().min(0, range01).max(1, range01).optional(),
      use_speaker_boost: z.boolean().optional(),
      speed: z.number().min(0.7, rangeSpeed).max(1.2, rangeSpeed).optional(),
    })
    .optional()
}

const speakerConfigSchema = (t: TFunction) => z.object({
  name: z.string().min(1, t('common.nameRequired') || 'Name is required'),
  voice_id: z.string().min(1, t('podcasts.voiceIdRequired') || 'Voice ID is required'),
  backstory: z.string().min(1, t('podcasts.backstoryRequired') || 'Backstory is required'),
  personality: z.string().min(1, t('podcasts.personalityRequired') || 'Personality is required'),
  voice_model: z.string().nullable().optional(),
  voice_settings: voiceSettingsSchema(t),
})

const speakerProfileSchema = (t: TFunction) => z.object({
  name: z.string().min(1, t('common.nameRequired') || 'Name is required'),
  description: z.string().optional(),
  voice_model: z.string().min(1, t('podcasts.voiceModelRequired') || 'Voice model is required'),
  speakers: z
    .array(speakerConfigSchema(t))
    .min(1, t('podcasts.speakerCountMin') || 'At least one speaker is required')
    .max(4, t('podcasts.speakerCountMax') || 'You can configure up to 4 speakers'),
  voice_settings: voiceSettingsSchema(t),
})

export type SpeakerProfileFormValues = z.infer<ReturnType<typeof speakerProfileSchema>>

interface SpeakerProfileFormDialogProps {
  mode: 'create' | 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: SpeakerProfile
}

const EMPTY_SPEAKER = {
  name: '',
  voice_id: '',
  backstory: '',
  personality: '',
  voice_model: null as string | null,
}

const VOICE_SETTING_NUMBER_FIELDS = [
  { key: 'stability', labelKey: 'podcasts.vsStability', min: 0, max: 1 },
  { key: 'similarity_boost', labelKey: 'podcasts.vsSimilarityBoost', min: 0, max: 1 },
  { key: 'style', labelKey: 'podcasts.vsStyle', min: 0, max: 1 },
  { key: 'speed', labelKey: 'podcasts.vsSpeed', min: 0.7, max: 1.2 },
] as const

type VoiceSettingsPath = 'voice_settings' | `speakers.${number}.voice_settings`

function VoiceSettingsSection({
  basePath,
  register,
  control,
  t,
}: {
  basePath: VoiceSettingsPath
  register: UseFormRegister<SpeakerProfileFormValues>
  control: Control<SpeakerProfileFormValues>
  t: TFunction
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ChevronDown className="h-4 w-4" />
        {t('podcasts.advancedVoiceSettings') || 'Advanced voice settings (ElevenLabs)'}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <p className="pb-2 text-xs text-muted-foreground">
          {t('podcasts.advancedVoiceSettingsDesc') ||
            'Leave a field empty to use the provider default.'}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {VOICE_SETTING_NUMBER_FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={`${basePath}-${f.key}`}>
                {t(f.labelKey) || f.key}
              </Label>
              <Input
                id={`${basePath}-${f.key}`}
                type="number"
                min={f.min}
                max={f.max}
                step={0.05}
                placeholder={t('podcasts.vsDefaultPlaceholder') || 'default'}
                {...register(
                  `${basePath}.${f.key}` as FieldPath<SpeakerProfileFormValues>,
                  numberInput
                )}
              />
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor={`${basePath}-use_speaker_boost`}>
              {t('podcasts.vsSpeakerBoost') || 'Speaker boost'}
            </Label>
            <Controller
              control={control}
              name={`${basePath}.use_speaker_boost` as FieldPath<SpeakerProfileFormValues>}
              render={({ field }) => (
                <Select
                  value={field.value === true ? 'on' : field.value === false ? 'off' : 'default'}
                  onValueChange={(v) =>
                    field.onChange(v === 'on' ? true : v === 'off' ? false : undefined)
                  }
                >
                  <SelectTrigger id={`${basePath}-use_speaker_boost`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      {t('podcasts.vsDefaultPlaceholder') || 'default'}
                    </SelectItem>
                    <SelectItem value="on">{t('common.enabled') || 'Enabled'}</SelectItem>
                    <SelectItem value="off">{t('common.disabled') || 'Disabled'}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function SpeakerProfileFormDialog({
  mode,
  open,
  onOpenChange,
  initialData,
}: SpeakerProfileFormDialogProps) {
  const { t } = useTranslation()
  const createProfile = useCreateSpeakerProfile()
  const updateProfile = useUpdateSpeakerProfile()

  const getDefaults = useCallback((): SpeakerProfileFormValues => {
    if (initialData) {
      return {
        name: initialData.name,
        description: initialData.description ?? '',
        voice_model: initialData.voice_model ?? '',
        voice_settings: initialData.voice_settings ?? undefined,
        speakers: initialData.speakers?.map((speaker) => ({
          ...speaker,
          voice_model: speaker.voice_model ?? null,
          voice_settings: speaker.voice_settings ?? undefined,
        })) ?? [{ ...EMPTY_SPEAKER }],
      }
    }

    return {
      name: '',
      description: '',
      voice_model: '',
      speakers: [{ ...EMPTY_SPEAKER }],
    }
  }, [initialData])

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SpeakerProfileFormValues>({
    resolver: zodResolver(speakerProfileSchema(t)),
    defaultValues: getDefaults(),
  })

  const {
    fields,
    append,
    remove,
  } = useFieldArray({
    control,
    name: 'speakers',
  })

  const { data: models } = useModels()
  const profileVoiceModel = watch('voice_model')
  const speakerVoiceModels = watch('speakers')

  const isElevenLabs = useCallback(
    (modelId?: string | null) =>
      !!modelId &&
      models?.find((m) => m.id === modelId)?.provider === 'elevenlabs',
    [models]
  )

  const speakersArrayError = (
    errors.speakers as FieldErrorsImpl<{ root?: { message?: string } }> | undefined
  )?.root?.message

  useEffect(() => {
    if (!open) {
      return
    }
    reset(getDefaults())
  }, [open, reset, getDefaults])

  const onSubmit = async (values: SpeakerProfileFormValues) => {
    const payload = {
      ...values,
      description: values.description ?? '',
      voice_settings: cleanVoiceSettings(values.voice_settings),
      speakers: values.speakers.map((s) => ({
        ...s,
        voice_model: s.voice_model || null,
        voice_settings: cleanVoiceSettings(s.voice_settings),
      })),
    }

    if (mode === 'create') {
      await createProfile.mutateAsync(payload)
    } else if (initialData) {
      await updateProfile.mutateAsync({
        profileId: initialData.id,
        payload,
      })
    }

    onOpenChange(false)
  }

  const isSubmitting = createProfile.isPending || updateProfile.isPending
  const disableSubmit = isSubmitting
  const isEdit = mode === 'edit'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('podcasts.editSpeakerProfile') : t('podcasts.createSpeakerProfile')}
          </DialogTitle>
          <DialogDescription>
            {t('podcasts.speakerProfileFormDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t('podcasts.profileName')} *</Label>
              <Input id="name" placeholder={t('podcasts.profileNamePlaceholder')} {...register('name')} />
              {errors.name ? (
                <p className="text-xs text-red-600">{errors.name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('common.description')}</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder={t('podcasts.descriptionPlaceholder')}
                {...register('description')}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t('podcasts.voiceModel')}
              </h3>
              <Separator className="mt-2" />
            </div>
            <Controller
              control={control}
              name="voice_model"
              render={({ field }) => (
                <div>
                  <ModelSelector
                    label={`${t('podcasts.voiceModel')} *`}
                    modelType="text_to_speech"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('podcasts.selectVoiceModel')}
                  />
                  {errors.voice_model ? (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.voice_model.message}
                    </p>
                  ) : null}
                </div>
              )}
            />
            {isElevenLabs(profileVoiceModel) ? (
              <VoiceSettingsSection
                basePath="voice_settings"
                register={register}
                control={control}
                t={t}
              />
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('podcasts.speakers')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('podcasts.speakersDesc')}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ ...EMPTY_SPEAKER })}
                disabled={fields.length >= 4}
              >
                <Plus className="mr-2 h-4 w-4" /> {t('podcasts.addSpeaker')}
              </Button>
            </div>
            <Separator />

            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {t('podcasts.speakerNumber').replace('{number}', (index + 1).toString())}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> {t('common.remove')}
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`speaker-name-${index}`}>{t('common.name')} *</Label>
                    <Input
                      id={`speaker-name-${index}`}
                      {...register(`speakers.${index}.name` as const)}
                      placeholder={t('podcasts.hostPlaceholder').replace('{number}', (index + 1).toString())}
                      autoComplete="off"
                    />
                    {errors.speakers?.[index]?.name ? (
                      <p className="text-xs text-red-600">
                        {errors.speakers[index]?.name?.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`speaker-voice-${index}`}>{t('podcasts.voiceId')} *</Label>
                    <Input
                      id={`speaker-voice-${index}`}
                      {...register(`speakers.${index}.voice_id` as const)}
                      placeholder="voice_123"
                      autoComplete="off"
                    />
                    {errors.speakers?.[index]?.voice_id ? (
                      <p className="text-xs text-red-600">
                        {errors.speakers[index]?.voice_id?.message}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`speaker-backstory-${index}`}>{t('podcasts.backstory')} *</Label>
                  <Textarea
                    id={`speaker-backstory-${index}`}
                    rows={3}
                    placeholder={t('podcasts.backstoryPlaceholder')}
                    {...register(`speakers.${index}.backstory` as const)}
                    autoComplete="off"
                  />
                  {errors.speakers?.[index]?.backstory ? (
                    <p className="text-xs text-red-600">
                      {errors.speakers[index]?.backstory?.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`speaker-personality-${index}`}>{t('podcasts.personality')} *</Label>
                  <Textarea
                    id={`speaker-personality-${index}`}
                    rows={3}
                    placeholder={t('podcasts.personalityPlaceholder')}
                    {...register(`speakers.${index}.personality` as const)}
                    autoComplete="off"
                  />
                  {errors.speakers?.[index]?.personality ? (
                    <p className="text-xs text-red-600">
                      {errors.speakers[index]?.personality?.message}
                    </p>
                  ) : null}
                </div>
                <Controller
                  control={control}
                  name={`speakers.${index}.voice_model` as const}
                  render={({ field: vmField }) => (
                    <div>
                      <ModelSelector
                        label={t('podcasts.perSpeakerTtsOverride')}
                        modelType="text_to_speech"
                        value={vmField.value ?? ''}
                        onChange={(v) => vmField.onChange(v || null)}
                        placeholder={t('podcasts.useProfileDefault')}
                      />
                    </div>
                  )}
                />
                {isElevenLabs(
                  speakerVoiceModels?.[index]?.voice_model || profileVoiceModel
                ) ? (
                  <VoiceSettingsSection
                    basePath={`speakers.${index}.voice_settings`}
                    register={register}
                    control={control}
                    t={t}
                  />
                ) : null}
              </div>
            ))}

            {speakersArrayError ? (
              <p className="text-xs text-red-600">{speakersArrayError}</p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={disableSubmit}>
              {isSubmitting
                ? t('common.saving')
                : isEdit
                  ? t('common.saveChanges')
                  : t('podcasts.createProfile')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
