export const ROLES = ["سالب", "موجب", "تبادل"] as const;
export type Role = (typeof ROLES)[number] | "";

export const INTENTS = ["مواعدة", "مقابلة", "دردشة"] as const;
export type Intent = (typeof INTENTS)[number] | "";

export type Profile = {
  userId: string;
  name: string;
  bio: string;
  pronouns: string;
  city: string;
  lookingFor: string;
  interests: string[];
  photoUrl: string;
  coverUrl: string;
  online: boolean;
  isCommunity: boolean;
  isAdmin: boolean;
  role: Role;
  intent: Intent;
  phone: string;
  showOnMap: boolean;
  gallery: string[];
  privateGallery: string[];
  hasPrivate: boolean;
  privateGranted: boolean;
  distanceKm: number | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
};

export function isProfileComplete(p: Pick<Profile, "name" | "role" | "intent">): boolean {
  return Boolean(p.role) && Boolean(p.intent) && p.name.trim().length > 0 && p.name !== "عضو جديد";
}

export type ChatPreview = {
  peerId: string;
  lastText: string;
  lastType: string;
  lastSenderId: string;
  lastAt: string;
  unread: number;
};

export type MsgType = "text" | "image" | "video" | "file" | "voice";

export type Message = {
  id: number;
  senderId: string;
  type: string;
  text: string;
  fileUrl: string | null;
  viewOnce: boolean;
  opened: boolean;
  durationSec: number;
  createdAt: string;
};

export type ConnectRequest = {
  id: number;
  fromId: string;
  toId: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  direction: "in" | "out";
};

export type CallLog = {
  id: number;
  peerId: string;
  kind: "audio" | "video";
  direction: "in" | "out";
  durationSec: number;
  createdAt: string;
};

export type Notice = {
  id: number;
  kind: string;
  fromId: string;
  text: string;
  read: boolean;
  createdAt: string;
};
