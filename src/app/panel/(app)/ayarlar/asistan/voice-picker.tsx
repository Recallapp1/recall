"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { saveAssistantVoice } from "../actions";
import { SaveButton, SettingsCard, useSave } from "../_components/settings-ui";

export interface VoiceOption {
  id: string;
  name: string;
  gender: "female" | "male";
  previewUrl: string | null;
}

const GENDERS = [
  { value: "female", label: "Kadın sesleri" },
  { value: "male", label: "Erkek sesleri" },
] as const;

/** "" stands for Recall's default voice. */
const DEFAULT = "";

export function VoicePicker({
  voices,
  selected,
  defaultVoice,
  editable,
}: {
  voices: VoiceOption[];
  selected: string | null;
  defaultVoice: VoiceOption | null;
  editable: boolean;
}) {
  const current = selected ?? DEFAULT;
  const [choice, setChoice] = useState(current);
  const [gender, setGender] = useState<VoiceOption["gender"]>(
    voices.find((voice) => voice.id === current)?.gender ?? defaultVoice?.gender ?? "female",
  );
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const { pending, save } = useSave();

  useEffect(() => () => audio.current?.pause(), []);

  const togglePreview = (voice: VoiceOption) => {
    if (!voice.previewUrl) return;
    audio.current?.pause();
    if (playing === voice.id) {
      setPlaying(null);
      return;
    }
    const clip = new Audio(voice.previewUrl);
    clip.onended = () => setPlaying(null);
    clip.onerror = () => setPlaying(null);
    audio.current = clip;
    setPlaying(voice.id);
    void clip.play().catch(() => setPlaying(null));
  };

  const shown = voices.filter((voice) => voice.gender === gender);

  return (
    <SettingsCard
      title="Ses"
      description="Örnek kayıtlar sağlayıcının İngilizce örnekleridir. Sesin Türkçede nasıl duyulduğunu kaydettikten sonra test aramasıyla dinleyin."
      footer={
        editable && (
          <SaveButton
            pending={pending}
            disabled={choice === current}
            onClick={() => save(() => saveAssistantVoice({ voiceId: choice || null }))}
          />
        )
      }
    >
      {voices.length === 0 ? (
        <p className="text-sm text-body">
          Ses listesi şu anda alınamadı. Asistan{" "}
          {defaultVoice ? `varsayılan sesle (${defaultVoice.name})` : "mevcut sesiyle"} konuşmaya
          devam eder.
        </p>
      ) : (
        <>
          <div role="tablist" aria-label="Ses türü" className="flex gap-2">
            {GENDERS.map((item) => (
              <Button
                key={item.value}
                role="tab"
                aria-selected={gender === item.value}
                variant={gender === item.value ? "default" : "outline"}
                size="sm"
                onClick={() => setGender(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Asistanın sesi</legend>
            {defaultVoice && (
              <VoiceRow
                voice={{ ...defaultVoice, id: DEFAULT }}
                label={`Recall varsayılanı (${defaultVoice.name})`}
                checked={choice === DEFAULT}
                disabled={!editable}
                playing={playing === defaultVoice.id}
                onSelect={() => setChoice(DEFAULT)}
                onPreview={() => togglePreview(defaultVoice)}
              />
            )}
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
              {shown.map((voice) => (
                <VoiceRow
                  key={voice.id}
                  voice={voice}
                  label={voice.name}
                  checked={choice === voice.id}
                  disabled={!editable}
                  playing={playing === voice.id}
                  onSelect={() => setChoice(voice.id)}
                  onPreview={() => togglePreview(voice)}
                />
              ))}
            </div>
          </fieldset>
        </>
      )}
    </SettingsCard>
  );
}

function VoiceRow({
  voice,
  label,
  checked,
  disabled,
  playing,
  onSelect,
  onPreview,
}: {
  voice: VoiceOption;
  label: string;
  checked: boolean;
  disabled: boolean;
  playing: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  const inputId = `voice-${voice.id || "default"}`;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-card-sm border px-4 py-2.5 transition-colors",
        checked ? "border-primary bg-primary-soft" : "border-hairline bg-paper",
      )}
    >
      <input
        id={inputId}
        type="radio"
        name="voice"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="size-4 shrink-0 accent-primary"
      />
      <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer text-sm text-heading">
        {label}
      </label>
      {voice.previewUrl && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onPreview}
          aria-label={playing ? `${label} örneğini durdur` : `${label} örneğini dinle`}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
      )}
    </div>
  );
}
