import {
  ChevronDown,
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
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { callDurationSec, useCallStore } from "@/lib/bq/call-store";
import { MediaCall } from "@/lib/bq/webrtc-call";
import {
  MEDIA_SETTINGS_HINT,
  mediaErrorMessage,
  requestCallMedia,
} from "@/lib/bq/media-permission";
import {
  findPerson,
  useBqMutations,
  useCallSession,
  useIncomingCall,
  useMe,
  usePeople,
} from "@/lib/bq/hooks";
import { cn, formatDuration } from "@/lib/utils";

const ENDED_KEY = "bq-ended-calls";
const CALL_HISTORY_KEY = "bq-call";

function loadEnded(): Set<number> {
  try {
    const raw = sessionStorage.getItem(ENDED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function markEnded(id: number) {
  const s = loadEnded();
  s.add(id);
  // keep last 40 ids
  const arr = [...s].slice(-40);
  try {
    sessionStorage.setItem(ENDED_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

function wasEnded(id: number) {
  return loadEnded().has(id);
}

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
  const [hasLocalVideo, setHasLocalVideo] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [rtcReady, setRtcReady] = useState(false);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pipLocalRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const rtcRef = useRef<MediaCall | null>(null);
  const seenSignals = useRef(0);
  const offered = useRef(false);
  const closing = useRef(false);
  const historyPushed = useRef(false);
  const sendRef = useRef(sendSignal.mutateAsync);
  sendRef.current = sendSignal.mutateAsync;
  const hangRef = useRef(hangLive.mutateAsync);
  hangRef.current = hangLive.mutateAsync;

  const mediaOn = Boolean(
    call.active && call.callId && (call.role === "out" || call.phase === "live"),
  );

  const name = person?.name || call.peerName || "شخص";
  const photo = person?.photoUrl || call.peerPhoto;

  // ── History: one entry while call is active. System back = hang only. ──
  useEffect(() => {
    if (!call.active || !call.callId) return;
    if (historyPushed.current) return;
    try {
      window.history.pushState({ [CALL_HISTORY_KEY]: call.callId }, "");
      historyPushed.current = true;
    } catch {
      /* ignore */
    }
  }, [call.active, call.callId]);

  useEffect(() => {
    function onPopState() {
      const st = useCallStore.getState();
      if (!st.active) {
        historyPushed.current = false;
        return;
      }
      // Back during call → end call completely, stay on page.
      historyPushed.current = false;
      void finishAsync(
        st.callId,
        st.role === "in" && st.phase === "ring" ? "decline" : "hang",
      );
      try {
        window.history.pushState({ [CALL_HISTORY_KEY]: "closed" }, "");
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // ── Incoming: never re-open a call we already ended this session ──
  useEffect(() => {
    const row = incoming.data;
    if (!row || call.active) return;
    if (wasEnded(row.id)) {
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
  }, [incoming.data, call.active, qc]);

  // ── Remote status changes ──
  useEffect(() => {
    const row = session.data?.call;
    if (!row || !call.active) return;
    if (row.status === "live" && call.phase === "ring") {
      useCallStore.getState().answer();
    }
    if (row.status === "declined" || row.status === "missed" || row.status === "ended") {
      if (closing.current) return;
      closing.current = true;
      markEnded(row.id);
      teardownMedia();
      useCallStore.getState().hang();
      void qc.setQueryData(["incoming-call"], null);
      void qc.removeQueries({ queryKey: ["call-session", row.id] });
      void qc.invalidateQueries({ queryKey: ["messages"] });
      void qc.invalidateQueries({ queryKey: ["chats"] });
      void qc.invalidateQueries({ queryKey: ["calls"] });
      void qc.invalidateQueries({ queryKey: ["incoming-call"] });
      historyPushed.current = false;
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

  function teardownMedia() {
    rtcRef.current?.close();
    rtcRef.current = null;
    localStreamRef.current = null;
    setLinked(false);
    setRtcReady(false);
    setCamError("");
  }

  // ── Open WebRTC when mediaOn ──
  useEffect(() => {
    if (!mediaOn) return;
    if (rtcRef.current) return;
    const media = new MediaCall();
    rtcRef.current = media;
    offered.current = false;
    seenSignals.current = 0;
    setLinked(false);
    setHasLocalVideo(false);
    setHasRemoteVideo(false);
    setRtcReady(false);
    setCamError("");

    const attachLocal = (stream: MediaStream) => {
      localStreamRef.current = stream;
      const vids = stream.getVideoTracks().filter((x) => x.readyState === "live");
      setHasLocalVideo(vids.length > 0);
      for (const el of [localRef.current, pipLocalRef.current]) {
        if (!el) continue;
        el.srcObject = stream;
        el.muted = true;
        el.playsInline = true;
        el.setAttribute("playsinline", "true");
        el.setAttribute("webkit-playsinline", "true");
        const play = () => void el.play().catch(() => undefined);
        play();
        // Android sometimes needs a second play() after metadata
        el.onloadedmetadata = play;
      }
    };
    const attachRemote = (stream: MediaStream) => {
      const vids = stream.getVideoTracks().filter((x) => x.readyState === "live");
      setHasRemoteVideo(vids.length > 0);
      setLinked(true);
      if (remoteRef.current) {
        remoteRef.current.srcObject = stream;
        remoteRef.current.muted = true;
        remoteRef.current.playsInline = true;
        remoteRef.current.setAttribute("playsinline", "true");
        remoteRef.current.setAttribute("webkit-playsinline", "true");
        const play = () => {
          void remoteRef.current
            ?.play()
            .then(() => {
              if (remoteRef.current) {
                remoteRef.current.muted = !useCallStore.getState().speaker;
              }
            })
            .catch(() => undefined);
        };
        play();
        remoteRef.current.onloadedmetadata = play;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.muted = !useCallStore.getState().speaker;
        void remoteAudioRef.current.play().catch(() => undefined);
      }
    };

    media.onLocalStream = attachLocal;
    media.onRemoteStream = attachRemote;
    media.onSignal = (kind, payload) => {
      const id = useCallStore.getState().callId;
      if (!id) return;
      void sendRef.current({ callId: id, kind, payload: JSON.stringify(payload) });
    };

    const pre = useCallStore.getState().preStream;
    if (pre) useCallStore.getState().setPreStream(null);

    void media
      .open(call.kind === "video", pre)
      .then(() => {
        if (rtcRef.current !== media) return;
        media.setMuted(useCallStore.getState().muted);
        media.setCamOff(false); // always start with camera on for video calls
        if (call.kind === "video") useCallStore.getState().setCamOff(false);
        setHasLocalVideo(media.hasLocalVideo);
        setRtcReady(true);
        if (call.kind === "video" && !media.hasLocalVideo) {
          setCamError("الاتصال شغال صوت — الكاميرا لم تُفتح. اضغط تفعيل الكاميرا");
        }
      })
      .catch(async () => {
        // Last-chance: try acquiring again inside the effect (may fail without gesture)
        const retry = await requestCallMedia(call.kind === "video");
        if (retry.ok && rtcRef.current === media) {
          try {
            await media.open(call.kind === "video", retry.stream);
            media.setMuted(useCallStore.getState().muted);
            media.setCamOff(useCallStore.getState().camOff);
            setRtcReady(true);
            return;
          } catch {
            /* fall through */
          }
        }
        if (rtcRef.current === media) {
          setCamError(mediaErrorMessage(retry.ok ? "unavailable" : retry.reason));
        }
      });

    return () => {
      media.close();
      if (rtcRef.current === media) rtcRef.current = null;
      localStreamRef.current = null;
    };
  }, [mediaOn, call.kind]);

  // Caller offer after both live
  useEffect(() => {
    if (!rtcReady || !mediaOn) return;
    if (call.role !== "out" || call.phase !== "live") return;
    if (offered.current) return;
    offered.current = true;
    void rtcRef.current?.offer();
  }, [rtcReady, mediaOn, call.role, call.phase]);

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
    if (!media || !call.active) return;
    const remote = media.remoteStream;
    if (remote && remoteRef.current) {
      remoteRef.current.srcObject = remote;
      remoteRef.current.muted = !call.speaker;
      void remoteRef.current.play().catch(() => undefined);
    }
    if (remote && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remote;
      remoteAudioRef.current.muted = !call.speaker;
      void remoteAudioRef.current.play().catch(() => undefined);
    }
    const local = localStreamRef.current;
    if (local) {
      for (const el of [localRef.current, pipLocalRef.current]) {
        if (!el) continue;
        if (el.srcObject !== local) {
          el.srcObject = local;
          el.muted = true;
          void el.play().catch(() => undefined);
        }
      }
    }
  }, [call.minimized, call.active, call.speaker, linked]);

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
      const id = s.id;
      const kind = s.kind;
      let payload: unknown = s.payload;
      try {
        payload = JSON.parse(s.payload) as unknown;
      } catch {
        seenSignals.current = id;
        continue;
      }
      seenSignals.current = id;
      void media.handle(kind, payload);
    }
  }, [session.data?.signals, me.data?.userId, rtcReady]);

  useEffect(() => {
    if (!call.active || call.role !== "out" || call.phase !== "ring") return;
    const t = window.setTimeout(() => {
      const cur = useCallStore.getState();
      if (!cur.active || cur.phase !== "ring" || !cur.callId) return;
      void finishAsync(cur.callId, "hang", true);
    }, 45_000);
    return () => window.clearTimeout(t);
  }, [call.active, call.role, call.phase, call.callId]);

  async function finishAsync(
    id: number | null,
    reason: "hang" | "decline",
    timedOut = false,
  ) {
    if (closing.current) return;
    closing.current = true;
    if (id) markEnded(id);
    teardownMedia();
    // Clear local UI immediately so back / re-render cannot show the call again
    useCallStore.getState().hang();
    void qc.setQueryData(["incoming-call"], null);
    if (id) void qc.removeQueries({ queryKey: ["call-session", id] });
    historyPushed.current = false;

    if (id) {
      try {
        await hangRef.current({ callId: id, reason });
      } catch {
        /* still closed locally */
      }
    }
    void qc.invalidateQueries({ queryKey: ["messages"] });
    void qc.invalidateQueries({ queryKey: ["chats"] });
    void qc.invalidateQueries({ queryKey: ["calls"] });
    void qc.invalidateQueries({ queryKey: ["incoming-call"] });
    if (timedOut) toast.error("لا رد");
    closing.current = false;
  }

  function finish(reason: "hang" | "decline") {
    void finishAsync(call.callId, reason);
  }

  async function accept() {
    if (!call.callId) return;
    const media = await requestCallMedia(call.kind === "video");
    if (!media.ok) {
      setCamError(mediaErrorMessage(media.reason));
      toast.error(mediaErrorMessage(media.reason));
      return;
    }
    useCallStore.getState().setPreStream(media.stream);
    const res = await pickUp.mutateAsync(call.callId);
    if (!res.ok) {
      media.stream.getTracks().forEach((t) => t.stop());
      useCallStore.getState().setPreStream(null);
      toast.error("تعذر الرد");
      finish("hang");
      return;
    }
    call.answer();
  }

  async function retryPermissions() {
    setCamError("");
    const media = await requestCallMedia(call.kind === "video");
    if (!media.ok) {
      setCamError(mediaErrorMessage(media.reason));
      toast.error(mediaErrorMessage(media.reason));
      return;
    }
    // Replace any existing RTC with a fresh one using this stream
    teardownMedia();
    useCallStore.getState().setPreStream(media.stream);
    const m = new MediaCall();
    rtcRef.current = m;
    offered.current = false;
    seenSignals.current = 0;
    m.onLocalStream = (stream) => {
      localStreamRef.current = stream;
      for (const el of [localRef.current, pipLocalRef.current]) {
        if (!el) continue;
        el.srcObject = stream;
        el.muted = true;
        void el.play().catch(() => undefined);
      }
    };
    m.onRemoteStream = (stream) => {
      setLinked(true);
      if (remoteRef.current) {
        remoteRef.current.srcObject = stream;
        remoteRef.current.muted = !useCallStore.getState().speaker;
        void remoteRef.current.play().catch(() => undefined);
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.muted = !useCallStore.getState().speaker;
        void remoteAudioRef.current.play().catch(() => undefined);
      }
    };
    m.onSignal = (kind, payload) => {
      const id = useCallStore.getState().callId;
      if (!id) return;
      void sendRef.current({ callId: id, kind, payload: JSON.stringify(payload) });
    };
    const pre = media.stream;
    useCallStore.getState().setPreStream(null);
    try {
      await m.open(call.kind === "video", pre);
      m.setMuted(useCallStore.getState().muted);
      m.setCamOff(useCallStore.getState().camOff);
      setRtcReady(true);
      if (call.role === "out" && call.phase === "live") {
        offered.current = true;
        void m.offer();
      }
    } catch {
      setCamError(mediaErrorMessage("unavailable"));
    }
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
            finish("hang");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") finish("hang");
          }}
          aria-label="إنهاء"
        >
          <PhoneOff className="size-3.5" />
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-between overflow-hidden bg-bg px-6 py-10">
      <audio ref={remoteAudioRef} autoPlay playsInline />
      {call.kind === "video" ? (
        <>
          <video
            ref={remoteRef}
            playsInline
            autoPlay
            muted={false}
            className={cn(
              "absolute inset-0 size-full object-cover bg-black",
              linked && hasRemoteVideo ? "opacity-100" : "opacity-0",
            )}
          />
          {photo && !linked ? (
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
            className={cn(
              "absolute bottom-36 end-4 z-20 h-36 w-24 rounded-xl border border-border object-cover shadow-[var(--shadow-glow)] bg-elevated",
              // Mirror selfie preview like WhatsApp
              hasLocalVideo ? "scale-x-[-1]" : "opacity-60",
            )}
          />
        </>
      ) : photo ? (
        <img
          src={photo}
          alt=""
          className="pointer-events-none absolute inset-0 size-full object-cover object-center opacity-25 blur-2xl"
        />
      ) : null}
      <div className="absolute inset-0 bg-bg/30" />
      <div className="relative z-10 flex w-full items-center justify-between">
        <button
          type="button"
          onClick={() => call.minimize()}
          className="grid size-11 place-items-center rounded-full bg-bg/60"
          aria-label="تصغير"
        >
          <ChevronDown className="size-5" />
        </button>
        <p className="text-xs text-muted">
          {call.kind === "video" ? "مكالمة فيديو" : "مكالمة صوت"}
          {call.phase === "live"
            ? linked
              ? hasRemoteVideo
                ? " · متصل"
                : " · متصل (صوت)"
              : " · جاري الربط…"
            : ""}
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
        <p className="mt-1 text-sm text-muted tabular-nums drop-shadow">
          {call.phase === "ring" ? ringLabel : formatDuration(seconds)}
        </p>
        {camError ? (
          <div className="mt-3 max-w-xs space-y-2 text-center">
            <p className="text-xs text-danger">{camError}</p>
            <p className="text-[11px] leading-relaxed text-muted">{MEDIA_SETTINGS_HINT}</p>
            <button
              type="button"
              onClick={() => void retryPermissions()}
              className="mx-auto rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-fg"
            >
              تفعيل الكاميرا والميكروفون
            </button>
          </div>
        ) : null}
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
          onClick={() => finish(call.role === "in" && call.phase === "ring" ? "decline" : "hang")}
          className="grid size-16 place-items-center rounded-full bg-danger text-primary-fg"
          aria-label={call.role === "in" && call.phase === "ring" ? "رفض" : "إنهاء"}
        >
          <PhoneOff className="size-6" />
        </button>
      </div>
    </div>
  );
}
