import { ChevronDown, Maximize2, Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { useBqMutations, useMe, usePeople, findPerson } from "@/lib/bq/hooks";
import { callDurationSec, useCallStore } from "@/lib/bq/call-store";
import { cn, formatDuration } from "@/lib/utils";

export function CallLayer() {
  const call = useCallStore();
  const people = usePeople(call.active);
  const me = useMe(call.active);
  const { recordCall } = useBqMutations();
  const person = findPerson(people.data, me.data, call.peerId);
  const [seconds, setSeconds] = useState(0);
  const [camError, setCamError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const pipRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const name = person?.name || call.peerName || "شخص";
  const photo = person?.photoUrl || call.peerPhoto;

  useEffect(() => {
    if (!call.active || call.phase !== "live") {
      setSeconds(0);
      return;
    }
    setSeconds(callDurationSec());
    const t = window.setInterval(() => setSeconds(callDurationSec()), 1000);
    return () => window.clearInterval(t);
  }, [call.active, call.phase]);

  useEffect(() => {
    if (!call.active || call.kind !== "video" || call.camOff) {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      if (pipRef.current) pipRef.current.srcObject = null;
      return;
    }
    let gone = false;
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: true })
      .then((stream) => {
        if (gone) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        stream.getAudioTracks().forEach((tr) => {
          tr.enabled = !call.muted;
        });
        const apply = (el: HTMLVideoElement | null) => {
          if (!el) return;
          el.srcObject = stream;
          void el.play();
        };
        apply(videoRef.current);
        apply(pipRef.current);
      })
      .catch(() => setCamError("اسمح للكاميرا من إعدادات المتصفح"));
    return () => {
      gone = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [call.active, call.kind, call.camOff, call.muted]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((tr) => {
      tr.enabled = !call.muted;
    });
  }, [call.muted]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const el = call.minimized ? pipRef.current : videoRef.current;
    if (el) {
      el.srcObject = stream;
      void el.play();
    }
  }, [call.minimized, call.active, call.camOff]);

  if (!call.active) return null;

  function hang() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    const dur = call.phase === "live" ? callDurationSec() : 0;
    const peerId = call.peerId;
    const kind = call.kind;
    call.hang();
    if (peerId) {
      void recordCall.mutateAsync({ peerId, kind, durationSec: dur });
    }
  }

  if (call.minimized) {
    return (
      <button
        type="button"
        onClick={() => call.expand()}
        className="fixed bottom-24 start-3 z-40 flex w-44 items-center gap-2 overflow-hidden rounded-xl border border-border bg-surface/95 p-2 text-start shadow-[var(--shadow-glow)]"
        aria-label="تكبير المكالمة"
      >
        {call.kind === "video" && !call.camOff ? (
          <video ref={pipRef} muted playsInline autoPlay className="size-12 rounded-lg object-cover" />
        ) : (
          <Avatar name={name} src={photo} size="sm" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{name}</span>
          <span className="text-[11px] text-muted tabular-nums">
            {call.phase === "ring" ? "رنين…" : formatDuration(seconds)}
          </span>
        </span>
        <span
          role="button"
          tabIndex={0}
          className="grid size-9 place-items-center rounded-full bg-danger text-primary-fg"
          onClick={(e) => {
            e.stopPropagation();
            hang();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") hang();
          }}
          aria-label="إنهاء"
        >
          <PhoneOff className="size-3.5" />
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-40 mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-between overflow-hidden bg-bg px-6 py-10">
      {call.kind === "video" && !call.camOff ? (
        <video
          ref={videoRef}
          muted={!call.speaker}
          playsInline
          autoPlay
          className="absolute inset-0 size-full object-cover"
        />
      ) : photo ? (
        <img
          src={photo}
          alt=""
          className="pointer-events-none absolute inset-0 size-full object-cover object-center opacity-25 blur-2xl"
        />
      ) : null}
      <div className="absolute inset-0 bg-bg/40" />
      <div className="relative z-10 flex w-full items-center justify-between">
        <button
          type="button"
          onClick={() => call.minimize()}
          className="grid size-11 place-items-center rounded-full bg-bg/60"
          aria-label="تصغير"
        >
          <ChevronDown className="size-5" />
        </button>
        <p className="text-xs text-muted">{call.kind === "video" ? "مكالمة فيديو" : "مكالمة صوت"}</p>
        <span className="size-11" />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative">
          {call.phase === "ring" ? (
            <>
              <span className="absolute inset-0 rounded-full bg-primary/30 [animation:pulse-ring_1.6s_ease-out_infinite]" />
              <span className="absolute inset-0 rounded-full bg-accent/20 [animation:pulse-ring_1.6s_ease-out_infinite_0.4s]" />
            </>
          ) : null}
          <Avatar name={name} src={photo} size="hero" verified={person?.verified || person?.isAdmin} />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold">{name}</h1>
        <p className="mt-1 text-sm text-muted tabular-nums">
          {call.phase === "ring" ? (call.kind === "video" ? "رنين فيديو…" : "رنين…") : formatDuration(seconds)}
        </p>
        {camError ? <p className="mt-2 text-xs text-danger">{camError}</p> : null}
      </div>

      <div className="relative z-10 mb-6 flex items-center gap-3">
        {call.phase === "ring" ? (
          <button
            type="button"
            onClick={() => call.answer()}
            className="grid size-16 place-items-center rounded-full bg-online text-bg"
            aria-label="رد"
          >
            <Phone className="size-6" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => call.setMuted(!call.muted)}
              className={cn(
                "grid size-14 place-items-center rounded-full",
                call.muted ? "bg-fg text-bg" : "bg-elevated text-fg",
              )}
              aria-label={call.muted ? "ميكروفون" : "كتم"}
            >
              {call.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </button>
            <button
              type="button"
              onClick={() => call.setSpeaker(!call.speaker)}
              className={cn(
                "grid size-14 place-items-center rounded-full",
                call.speaker ? "bg-accent text-bg" : "bg-elevated text-fg",
              )}
              aria-label={call.speaker ? "إغلاق المكبر" : "مكبر الصوت"}
            >
              {call.speaker ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </button>
            {call.kind === "video" ? (
              <button
                type="button"
                onClick={() => call.setCamOff(!call.camOff)}
                className={cn(
                  "grid size-14 place-items-center rounded-full",
                  call.camOff ? "bg-fg text-bg" : "bg-elevated text-fg",
                )}
                aria-label={call.camOff ? "كاميرا" : "إيقاف الكاميرا"}
              >
                {call.camOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
              </button>
            ) : null}
          </>
        )}
        <button
          type="button"
          onClick={() => call.minimize()}
          className="grid size-14 place-items-center rounded-full bg-elevated text-fg"
          aria-label="تصغير"
        >
          <Maximize2 className="size-5 rotate-180" />
        </button>
        <button
          type="button"
          onClick={hang}
          className="grid size-16 place-items-center rounded-full bg-danger text-primary-fg"
          aria-label="إنهاء"
        >
          <PhoneOff className="size-6" />
        </button>
      </div>
    </div>
  );
}
