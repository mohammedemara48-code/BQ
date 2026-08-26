import { Link } from "@tanstack/react-router";
import { MapPin, MessageCircle, LocateFixed } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { useBqMutations, useMe, usePeople } from "@/lib/bq/hooks";
import type { Profile } from "@/lib/bq/types";

const TILE = 256;
const MIN_Z = 3;
const MAX_Z = 17;

function project(lng: number, lat: number, z: number) {
  const sin = Math.sin((lat * Math.PI) / 180);
  const x = ((lng + 180) / 360) * 2 ** z;
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * 2 ** z;
  return { x, y };
}

export function MapTab() {
  const people = usePeople();
  const me = useMe();
  const { saveMe } = useBqMutations();
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 520 });
  const [zoom, setZoom] = useState(6);
  const [center, setCenter] = useState({ lng: 31.2, lat: 27.2 });
  const [drag, setDrag] = useState<{ x: number; y: number; lng: number; lat: number } | null>(null);
  const [picked, setPicked] = useState<Profile | null>(null);

  const pins = useMemo(() => {
    const rows: Profile[] = [];
    if (me.data?.showOnMap && me.data.latitude != null && me.data.longitude != null) {
      rows.push(me.data);
    }
    for (const p of people.data ?? []) {
      if (p.showOnMap && p.latitude != null && p.longitude != null) rows.push(p);
    }
    return rows;
  }, [people.data, me.data]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mine = me.data;
    if (mine?.latitude != null && mine.longitude != null) {
      setCenter({ lng: mine.longitude, lat: mine.latitude });
      setZoom(11);
      return;
    }
    const first = pins[0];
    if (first?.latitude != null && first.longitude != null) {
      setCenter({ lng: first.longitude, lat: first.latitude });
      setZoom(8);
    }
  }, [me.data?.latitude, me.data?.longitude, pins.length]);

  function locate() {
    if (!navigator.geolocation) {
      toast.error("الموقع غير متاح");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void saveMe.mutateAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          showOnMap: true,
        });
        setCenter({ lng: pos.coords.longitude, lat: pos.coords.latitude });
        setZoom(12);
        toast.success("تم تحديد موقعك");
      },
      () => toast.error("لم يُسمح بالموقع"),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  const z = Math.round(zoom);
  const origin = project(center.lng, center.lat, z);
  const cols = Math.ceil(size.w / TILE) + 3;
  const rows = Math.ceil(size.h / TILE) + 3;
  const startX = Math.floor(origin.x - size.w / 2 / TILE) - 1;
  const startY = Math.floor(origin.y - size.h / 2 / TILE) - 1;
  const n = 2 ** z;

  const tiles: { key: string; left: number; top: number; tx: number; ty: number }[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const tx = ((startX + i) % n + n) % n;
      const ty = startY + j;
      if (ty < 0 || ty >= n) continue;
      tiles.push({
        key: `${z}-${tx}-${ty}`,
        tx,
        ty,
        left: (startX + i - origin.x) * TILE + size.w / 2,
        top: (startY + j - origin.y) * TILE + size.h / 2,
      });
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY, lng: center.lng, lat: center.lat });
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const p0 = project(drag.lng, drag.lat, z);
    const p1 = { x: p0.x - dx / TILE, y: p0.y - dy / TILE };
    const lng = (p1.x / 2 ** z) * 360 - 180;
    const n1 = Math.PI - (2 * Math.PI * p1.y) / 2 ** z;
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n1) - Math.exp(-n1)));
    setCenter({ lng, lat: Math.max(-85, Math.min(85, lat)) });
  }

  return (
    <div className="bq-enter relative flex flex-col px-0 pb-2 pt-0">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <h2 className="text-sm font-medium">خريطة الأعضاء</h2>
        <button
          type="button"
          onClick={locate}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-elevated px-3 text-sm"
        >
          <LocateFixed className="size-4 text-primary" />
          موقعي
        </button>
      </div>
      <div
        ref={wrap}
        className="relative mx-4 h-[62dvh] overflow-hidden rounded-xl border border-border bg-elevated touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        onWheel={(e) => {
          e.preventDefault();
          setZoom((z0) => Math.max(MIN_Z, Math.min(MAX_Z, z0 + (e.deltaY > 0 ? -1 : 1))));
        }}
      >
        {tiles.map((t) => (
          <img
            key={t.key}
            alt=""
            draggable={false}
            className="pointer-events-none absolute size-[256px] max-w-none select-none"
            style={{ left: t.left, top: t.top }}
            src={`https://tile.openstreetmap.org/${z}/${t.tx}/${t.ty}.png`}
          />
        ))}
        {pins.map((p) => {
          if (p.latitude == null || p.longitude == null) return null;
          const pt = project(p.longitude, p.latitude, z);
          const left = (pt.x - origin.x) * TILE + size.w / 2;
          const top = (pt.y - origin.y) * TILE + size.h / 2;
          return (
            <button
              key={p.userId}
              type="button"
              className="absolute z-10 -translate-x-1/2 -translate-y-full"
              style={{ left, top }}
              onClick={(e) => {
                e.stopPropagation();
                setPicked(p);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className="flex flex-col items-center">
                <Avatar name={p.name} src={p.photoUrl} size="sm" online={p.online} verified={p.verified} />
                <span className="mt-0.5 max-w-20 truncate rounded-full bg-bg/80 px-1.5 text-[10px]">
                  {p.name}
                </span>
              </span>
            </button>
          );
        })}
        {pins.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-bg/40">
            <p className="rounded-lg bg-surface px-3 py-2 text-center text-sm text-muted">
              لا أعضاء ظاهرين على الخريطة
              <br />
              فعّل موقعك من حسابك
            </p>
          </div>
        ) : null}
        <p className="pointer-events-none absolute bottom-1 start-2 text-[10px] text-muted">
          © OpenStreetMap
        </p>
      </div>
      <div className="mt-2 flex justify-center gap-2 px-4">
        <Button size="sm" variant="secondary" onClick={() => setZoom((z0) => Math.min(MAX_Z, z0 + 1))}>
          +
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setZoom((z0) => Math.max(MIN_Z, z0 - 1))}>
          −
        </Button>
      </div>
      {picked ? (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <Avatar name={picked.name} src={picked.photoUrl} online={picked.online} verified={picked.verified} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{picked.name}</p>
            <p className="truncate text-xs text-muted">
              {picked.city || picked.serial || "عضو"}
            </p>
          </div>
          {picked.userId === me.data?.userId ? (
            <span className="text-xs text-muted">أنت</span>
          ) : (
            <>
              <Link to="/person/$id" params={{ id: picked.userId }}>
                <Button size="icon" variant="ghost" aria-label="الملف">
                  <MapPin className="size-4" />
                </Button>
              </Link>
              <Link to="/chat/$peerId" params={{ peerId: picked.userId }}>
                <Button size="icon" variant="secondary" aria-label="محادثة">
                  <MessageCircle className="size-4" />
                </Button>
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
