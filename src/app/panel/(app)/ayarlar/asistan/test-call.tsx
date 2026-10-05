"use client";

import { LoaderCircle, Mic, MicOff, PhoneOff, PhoneOutgoing } from "lucide-react";
import { useEffect, useRef, useState } from "react";
// Browser half of the voice provider: the only Retell code outside
// src/server/voice/providers/retell (it has to run in the browser).
// RetellWebClient is the token-based client; migrate before SDK 4.0 removes it.
import { RetellWebClient } from "retell-client-js-sdk";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { startTestCall } from "../actions";
import { SettingsCard } from "../_components/settings-ui";

type Status = "idle" | "connecting" | "live" | "ended" | "error";

const STATUS_TEXT: Record<Status, string> = {
  idle: "Mikrofon izni istenir; asistanla bir hasta gibi konuşabilirsiniz.",
  connecting: "Bağlanıyor…",
  live: "Görüşme sürüyor",
  ended: "Görüşme bitti. Özeti birkaç dakika içinde Aramalar sayfasında görebilirsiniz.",
  error: "",
};

export function TestCall() {
  const client = useRef<RetellWebClient | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [agentTalking, setAgentTalking] = useState(false);

  useEffect(() => () => client.current?.stopCall(), []);

  const start = async () => {
    setError("");
    setStatus("connecting");
    // Ask for the microphone first, so no call is opened (and billed) without one.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setError(
        "Mikrofon izni verilmedi. Tarayıcının adres çubuğundan mikrofona izin verip tekrar deneyin.",
      );
      setStatus("error");
      return;
    }
    const result = await startTestCall();
    if (!result.ok) {
      setError(result.message);
      setStatus("error");
      return;
    }
    const web = new RetellWebClient();
    client.current = web;
    web.on("call_started", () => setStatus("live"));
    web.on("call_ended", () => {
      setStatus("ended");
      setAgentTalking(false);
    });
    web.on("agent_start_talking", () => setAgentTalking(true));
    web.on("agent_stop_talking", () => setAgentTalking(false));
    web.on("error", () => {
      setError("Bağlantı kesildi. Lütfen tekrar deneyin.");
      setStatus("error");
      web.stopCall();
    });
    try {
      await web.startCall({
        accessToken: result.accessToken,
        callId: result.callId,
        transport: result.transport,
        iceServers: result.iceServers,
      });
    } catch {
      setError("Mikrofon kullanılamadı. Tarayıcıda mikrofon iznini verip tekrar deneyin.");
      setStatus("error");
    }
  };

  const stop = () => {
    client.current?.stopCall();
    setStatus("ended");
  };

  const toggleMute = () => {
    if (!client.current) return;
    if (muted) client.current.unmute();
    else client.current.mute();
    setMuted(!muted);
  };

  const live = status === "live" || status === "connecting";

  return (
    <SettingsCard
      title="Test araması"
      description="Asistanı telefon açmadan, tarayıcıdan deneyin. Ayar değişiklikleri birkaç saniye sonra geçerli olur. Test aramaları normal arama gibi ücretlendirilir ve Aramalar listesinde görünür."
    >
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden
          className={cn(
            "flex size-14 items-center justify-center rounded-full transition-colors",
            status === "live" ? "bg-primary text-on-dark" : "bg-primary-soft text-primary",
            agentTalking && "animate-pulse",
          )}
        >
          <Mic className="size-6" />
        </span>
        <p role="status" className="min-w-0 flex-1 text-sm text-body">
          {status === "error" ? <span className="text-danger">{error}</span> : STATUS_TEXT[status]}
          {status === "live" && (agentTalking ? " · asistan konuşuyor" : " · sizi dinliyor")}
        </p>
        {live ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMute}
              aria-label={muted ? "Mikrofonu aç" : "Mikrofonu kapat"}
              disabled={status !== "live"}
            >
              {muted ? <MicOff /> : <Mic />}
            </Button>
            <Button variant="destructive" onClick={stop}>
              {status === "connecting" ? <LoaderCircle className="animate-spin" /> : <PhoneOff />}
              Bitir
            </Button>
          </div>
        ) : (
          <Button onClick={start}>
            <PhoneOutgoing data-icon="inline-start" />
            {status === "ended" ? "Yeniden ara" : "Test araması başlat"}
          </Button>
        )}
      </div>
    </SettingsCard>
  );
}
