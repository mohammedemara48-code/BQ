import { useQueryClient } from "@tanstack/react-query";
import {
  Maximize2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  callDurationSec,
  markCallEnded,
  useCallStore,
  wasCallEnded,
} from "@/lib/bq/call-store";
import { MediaCall } from "@/lib/bq/webrtc-call";
import { findPerson, useBqMutations, useCallSession, useIncomingCall, useMe, usePeople } from "@/lib/bq/hooks";
import { cn, formatDuration } from "@/lib/utils";

export function CallLayer() {
  const { user } = useCurrentUserState();
  const qc = useQueryClient();
  const call = useCallStore();
  const incoming = useIncomingCall(Boolean(user) && !call.active);
  const session = useCallSession(call.callId);
  const people = usePeople(call.active);
  const me = useMe(call.active);
  const { pickUp, hangLive, sendSignal } = useBqMutations();
  const person = findPerson(people.data, me.data, call.peerId);
  const [seconds, setSeconds] = useState(0);
  const [camError, setCamError] = useState("");
  const [linked, setLinked] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [rtcReady, setRtcReady] = useState(false);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pipLocalRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const rtcRef = useRef<MediaCall | null>(null);
  const seenSignals = useRef(0);
  const offered = useRef(false);
  const closing = useRef(false);
  const sendRef = useRef(sendSignal.mutateAsync);
  sendRef.current = sendSignal.mutateAsync;
  const hangRef = useRef(hangLive.mutateAsync);
  hangRef.current = hangLive.mutateAsync;
  const mediaOn = Boolean(call.active && call.callId && (call.role === "out" || call.phase === "live"));

  const name = person?.name || call.peerName || "شخص";
  const photo = person?.photoUrl || call.peerPhoto;

  function attachToVideo(el: HTMLVideoElement | null, stream: MediaStream, muted: boolean) {
    if (!el) return;
    el.srcObject = stream;
    el.muted = muted;
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    const play = () => void el.play().catch(() => undefined);
    play();
    el.onloadedmetadata = play;
  }

  function attachMedia(media: MediaCall) {
    media.onLocalStream = (stream) => {
      attachToVideo(localRef.current, stream, true);
      attachToVideo(pipLocalRef.current, stream, true);
    };
    media.onRemoteStream = (stream) => {
      const vids = stream.getVideoTracks().filter((t) => t.readyState === "live");
      setHasRemoteVideo(vids.length > 0);
      setLinked(true);
      attachToVideo(remoteRef.current, stream, !useCallStore.getState().speaker);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.muted = !useCallStore.getState().speaker;
        void remoteAudioRef.current.play().catch(() => undefined);
      }
    };
    media.onSignal = (kind, payload) => {
      const id = useCallStore.getState().callId;
      if (!id) return;
      void sendRef.current({ callId: id, kind, payload: JSON.stringify(payload) });
    };
  }

  useEffect(() => {
    if (!call.ignoreIncoming) return;
    const t = window.setTimeout(() => {
      useCallStore.getState().setIgnoreIncoming(false);
    }, 5000);
    return () => window.clearTimeout(t);
  }, [call.ignoreIncoming]);

  useEffect(() => {
    const row = incoming.data;
    if (!row || call.active) return;
    if (wasCallEnded(row.id)) {
      void qc.setQueryData(["incoming-call"], null);
      return;
    }
    useCallStore.getState().incoming({
      callId: row.id,
      peerId: row.callerId,
      peerName: row.callerName,
      peerPhoto: row.callerPhoto,
      kind: row.kind,
    });
  }, [incoming.data, call.active, call.ignoreIncoming, qc]);

  useEffect(() => {
    function onPopState() {
      const st = useCallStore.getState();
      if (!st.active) return;
      const id = st.callId;
      const reason: "hang" | "decline" = st.role === "in" && st.phase === "ring" ? "decline" : "hang";
      markCallEnded(id);
      rtcRef.current?.close();
      rtcRef.current = null;
      useCallStore.getState().hang();
      void qc.setQueryData(["incoming-call"], null);
      if (id) void hangRef.current({ callId: id, reason }).catch(() => undefined);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [qc]);

  useEffect(() => {
    const row = session.data?.call;
    if (!row || !call.active) return;
    if (row.status === "live" && call.phase === "ring") {
      useCallStore.getState().answer();
    }
    if (row.status === "declined" || row.status === "missed" || row.status === "ended") {
      if (closing.current) return;
      closing.current = true;
      markCallEnded(row.id);
      rtcRef.current?.close();
      rtcRef.current = null;
      useCallStore.getState().hang();
      void qc.setQueryData(["incoming-call"], null);
      if (row.status === "declined") toast.error("تم رفض المكالمة");
      else if (row.status === "missed" && call.role === "out") toast.error("لا رد");
      closing.current = false;
    }
  }, [session.data?.call?.status, call.active, call.phase, call.role, qc]);

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
    if (!mediaOn) return;
    if (rtcRef.current) return;
    const media = new MediaCall();
    rtcRef.current = media;
    offered.current = false;
    seenSignals.current = 0;
    setLinked(false);
    setHasRemoteVideo(false);
    setRtcReady(false);
    attachMedia(media);
    const pre = useCallStore.getState().preStream;
    void media
      .open(call.kind === "video", pre)
      .then(() => {
        if (pre) useCallStore.getState().setPreStream(null);
        media.setMuted(useCallStore.getState().muted);
        if (call.kind === "video") {
          useCallStore.getState().setCamOff(false);
          media.setCamOff(false);
        } else {
          media.setCamOff(useCallStore.getState().camOff);
        }
        setRtcReady(true);
      })
      .catch(() => setCamError("اسمح للميكروفون والكاميرا من الإعدادات"));
    return () => {
      media.close({ stopLocal: false });
      if (rtcRef.current === media) rtcRef.current = null;
    };
  }, [mediaOn, call.kind]);

  useEffect(() => {
    if (!rtcReady) return;
    if (call.role !== "out" || call.phase !== "live") return;
    if (offered.current) return;
    offered.current = true;
    void rtcRef.current?.offer();
  }, [rtcReady, call.role, call.phase]);

  useEffect(() => {
    rtcRef.current?.setMuted(call.muted);
  }, [call.muted]);

  useEffect(() => {
    rtcRef.current?.setCamOff(call.camOff);
  }, [call.camOff]);

  useEffect(() => {
    const mute = !call.speaker;
    if (remoteRef.current) remoteRef.current.muted = mute;
    if (remoteAudioRef.current) remoteAudioRef.current.muted = mute;
  }, [call.speaker]);

  useEffect(() => {
    const media = rtcRef.current;
    const signals = session.data?.signals;
    if (!media?.ready || !signals) return;
    const mine = me.data?.userId;
    for (const s of signals) {
      if (s.id <= seenSignals.current) continue;
      if (mine && s.fromId === mine) {
        seenSignals.current = s.id;
        continue;
      }
      let payload: unknown = s.payload;
      try {
        payload = JSON.parse(s.payload) as unknown;
      } catch {
        seenSignals.current = s.id;
        continue;
      }
      void media.handle(s.kind, payload);
      seenSignals.current = s.id;
    }
  }, [session.data?.signals, me.data?.userId, rtcReady]);

  useEffect(() => {
    if (!call.active || call.role !== "out" || call.phase !== "ring") return;
    const t = window.setTimeout(() => {
      const cur = useCallStore.getState();
      if (!cur.active || cur.phase !== "ring" || !cur.callId) return;
      void finish("hang");
      toast.error("لا رد");
    }, 60_000);
    return () => window.clearTimeout(t);
  }, [call.active, call.role, call.phase, call.callId]);

  async function finish(reason: "hang" | "decline") {
    if (closing.current) return;
    closing.current = true;
    const id = useCallStore.getState().callId;
    markCallEnded(id);
    rtcRef.current?.close();
    rtcRef.current = null;
    useCallStore.getState().hang();
    void qc.setQueryData(["incoming-call"], null);
    void qc.cancelQueries({ queryKey: ["incoming-call"] });
    if (id) {
      try {
        await hangRef.current({ callId: id, reason });
      } catch {
        /* local UI already closed */
      }
    }
    void qc.invalidateQueries({ queryKey: ["calls"] });
    void qc.invalidateQueries({ queryKey: ["chats"] });
    void qc.invalidateQueries({ queryKey: ["messages"] });
    closing.current = false;
  }

  async function accept() {
    if (!call.callId) return;
    try {
      if (!rtcRef.current) {
        const media = new MediaCall();
        attachMedia(media);
        await media.open(call.kind === "video");
        rtcRef.current = media;
        offered.current = false;
        seenSignals.current = 0;
        setRtcReady(true);
      }
    } catch {
      setCamError("اسمح للميكروفون والكاميرا من الإعدادات");
      return;
    }
    const res = await pickUp.mutateAsync(call.callId);
    if (!res.ok) {
      toast.error("تعذر الرد");
      void finish("hang");
      return;
    }
    call.answer();
  }

  if (!call.active) return null;

  const ringLabel =
    call.role === "in"
      ? call.kind === "video"
        ? "مكالمة فيديو واردة"
        : "مكالمة واردة"
      : call.kind === "video"
        ? "جاري الاتصال فيديو…"
        : "جاري الاتصال…";

  if (call.minimized) {
    return (
      <button
        type="button"
        onClick={() => call.expand()}
        className="fixed bottom-24 start-3 z-50 flex w-44 items-center gap-2 overflow-hidden rounded-xl border border-border bg-surface/95 p-2 text-start shadow-[var(--shadow-glow)]"
        aria-label="تكبير المكالمة"
      >
        {call.kind === "video" && !call.camOff ? (
          <video ref={pipLocalRef} muted playsInline autoPlay className="size-12 rounded-lg object-cover" />
        ) : (
          <Avatar name={name} src={photo} size="sm" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{name}</span>
          <span className="text-[11px] text-muted tabular-nums">
            {call.phase === "ring" ? (call.role === "in" ? "واردة" : "رنين…") : formatDuration(seconds)}
          </span>
        </span>
        <span
          role="button"
          tabIndex={0}
          className="grid size-9 place-items-center rounded-full bg-danger text-primary-fg"
          onClick={(e) => {
            e.stopPropagation();
            void finish("hang");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void finish("hang");
          }}
          aria-label="إنهاء"
        >
          <PhoneOff className="size-3.5" />
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="relative mx-auto flex h-dvh w-full max-w-lg flex-col items-center justify-between overflow-hidden px-6 py-10">
        <audio ref={remoteAudioRef} autoPlay />
        {call.kind === "video" ? (
          <>
            <video
              ref={remoteRef}
              playsInline
              autoPlay
              className={cn(
                "absolute inset-0 size-full object-cover",
                linked && hasRemoteVideo ? "opacity-100" : "opacity-0",
              )}
            />
            {photo && !(linked && hasRemoteVideo) ? (
              <img
                src={photo}
                alt=""
                className="pointer-events-none absolute inset-0 size-full object-cover object-center opacity-25 blur-2xl"
              />
            ) : null}
            <video
              ref={localRef}
              muted
              playsInline
              autoPlay
              className="absolute bottom-36 end-4 z-20 h-36 w-24 scale-x-[-1] rounded-xl border border-border object-cover shadow-[var(--shadow-glow)]"
            />
          </>
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
            onClick={() => void finish(call.role === "in" && call.phase === "ring" ? "decline" : "hang")}
            className="grid size-11 place-items-center rounded-full bg-bg/60"
            aria-label="إنهاء المكالمة"
          >
            <PhoneOff className="size-5" />
          </button>
          <p className="text-xs text-muted">
            {call.kind === "video" ? "مكالمة فيديو" : "مكالمة صوت"}
            {call.phase === "live" ? (linked ? (hasRemoteVideo ? " · متصل" : " · متصل (صوت)") : " · جاري الربط…") : ""}
          </p>
          <span className="size-11" />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          {!(linked && hasRemoteVideo) || call.kind !== "video" || call.phase === "ring" ? (
            <>
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
            </>
          ) : (
            <h1 className="mt-2 font-display text-xl font-semibold drop-shadow">{name}</h1>
          )}
          <p className="mt-1 text-sm text-muted tabular-nums">
            {call.phase === "ring" ? ringLabel : formatDuration(seconds)}
          </p>
          {camError ? <p className="mt-2 text-xs text-danger">{camError}</p> : null}
        </div>

        <div className="relative z-10 mb-6 flex items-center gap-3">
          {call.phase === "ring" && call.role === "in" ? (
            <button
              type="button"
              onClick={() => void accept()}
              className="grid size-16 place-items-center rounded-full bg-online text-bg"
              aria-label="رد"
            >
              <Phone className="size-6" />
            </button>
          ) : call.phase === "live" ? (
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
          ) : null}
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
            onClick={() => void finish(call.role === "in" && call.phase === "ring" ? "decline" : "hang")}
            className="grid size-16 place-items-center rounded-full bg-danger text-primary-fg"
            aria-label={call.role === "in" && call.phase === "ring" ? "رفض" : "إنهاء"}
          >
            <PhoneOff className="size-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
