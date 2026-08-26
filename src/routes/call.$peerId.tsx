import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { findPerson, useBqMutations, useMe, usePeople } from "@/lib/bq/hooks";
import { startRingtone } from "@/lib/bq/ringtone";
import { cn, formatDuration } from "@/lib/utils";

export const Route = createFileRoute("/call/$peerId")({
  validateSearch: (s: Record<string, unknown>): { kind: "audio" | "video" } => ({
    kind: s.kind === "video" ? "video" : "audio",
  }),
  component: CallPage,
});

function CallPage() {
  const { user, isPending } = useCurrentUserState();
  const { peerId } = Route.useParams();
  const { kind } = Route.useSearch();
  const navigate = useNavigate();
  const people = usePeople();
  const me = useMe();
  const { recordCall } = useBqMutations();
  const person = findPerson(people.data, me.data, peerId);
  const [phase, setPhase] = useState<"ring" | "live">("ring");
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(kind !== "video");
  const [speaker, setSpeaker] = useState(kind === "video");
  const [seconds, setSeconds] = useState(0);
  const [camError, setCamError] = useState("");
  const liveAt = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hung = useRef(false);

  function backToChat() {
    void navigate({ to: "/chat/$peerId", params: { peerId } });
  }

  useEffect(() => {
    const stopRing = startRingtone();
    const t = window.setTimeout(() => {
      stopRing();
      if (hung.current) return;
      setPhase("live");
      liveAt.current = Date.now();
    }, 2400);
    return () => {
      stopRing();
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (phase !== "live") return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (kind !== "video" || camOff) {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        stream.getAudioTracks().forEach((tr) => {
          tr.enabled = !muted;
        });
      })
      .catch(() => setCamError("اسمح للكاميرا من إعدادات المتصفح"));
    return () => {
      gone = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [kind, camOff, muted]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((tr) => {
      tr.enabled = !muted;
    });
  }, [muted]);

  function hang() {
    hung.current = true;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    const dur = liveAt.current
      ? Math.max(1, Math.round((Date.now() - liveAt.current) / 1000))
      : 0;
    void recordCall.mutateAsync({ peerId, kind, durationSec: dur }).finally(() => {
      backToChat();
    });
  }

  if (isPending) return <div className="min-h-dvh bg-bg" />;
  if (!user) return <RedirectToSignIn />;

  const name = person?.name ?? "شخص";

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-between overflow-hidden bg-bg px-6 py-10">
      {kind === "video" && !camOff ? (
        <video
          ref={videoRef}
          muted={!speaker}
          playsInline
          autoPlay
          className="absolute inset-0 size-full object-cover"
        />
      ) : person?.photoUrl ? (
        <img
          src={person.photoUrl}
          alt=""
          className="pointer-events-none absolute inset-0 size-full object-cover object-center opacity-25 blur-2xl"
        />
      ) : null}
      <div className="absolute inset-0 bg-bg/40" />
      <div className="relative z-10 mt-8 flex flex-col items-center">
        <div className="relative">
          {phase === "ring" ? (
            <>
              <span className="absolute inset-0 rounded-full bg-primary/30 [animation:pulse-ring_1.6s_ease-out_infinite]" />
              <span className="absolute inset-0 rounded-full bg-accent/20 [animation:pulse-ring_1.6s_ease-out_infinite_0.4s]" />
            </>
          ) : null}
          <Avatar name={name} src={person?.photoUrl} size="hero" verified={person?.verified || person?.isAdmin} />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold">{name}</h1>
        <p className="mt-1 text-sm text-muted tabular-nums">
          {phase === "ring"
            ? kind === "video"
              ? "رنين فيديو…"
              : "رنين…"
            : formatDuration(seconds)}
        </p>
        <p className="mt-1 text-xs text-subtle">
          {speaker ? "مكبر الصوت شغال" : "سماعة الأذن"}
        </p>
        {camError ? <p className="mt-2 text-xs text-danger">{camError}</p> : null}
      </div>

      <div className="relative z-10 mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setMuted((v) => !v)}
          className={cn(
            "grid size-14 place-items-center rounded-full",
            muted ? "bg-fg text-bg" : "bg-elevated text-fg",
          )}
          aria-label={muted ? "ميكروفون" : "كتم"}
        >
          {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>
        <button
          type="button"
          onClick={() => setSpeaker((v) => !v)}
          className={cn(
            "grid size-14 place-items-center rounded-full",
            speaker ? "bg-accent text-bg" : "bg-elevated text-fg",
          )}
          aria-label={speaker ? "إغلاق المكبر" : "مكبر الصوت"}
        >
          {speaker ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
        {kind === "video" ? (
          <button
            type="button"
            onClick={() => setCamOff((v) => !v)}
            className={cn(
              "grid size-14 place-items-center rounded-full",
              camOff ? "bg-fg text-bg" : "bg-elevated text-fg",
            )}
            aria-label={camOff ? "كاميرا" : "إيقاف الكاميرا"}
          >
            {camOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
          </button>
        ) : null}
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
