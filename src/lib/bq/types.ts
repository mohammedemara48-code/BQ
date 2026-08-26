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
  verified: boolean;
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
  lastDelivered: boolean;
  lastSeen: boolean;
};

export type MsgType = "text" | "image" | "video" | "file" | "voice";

export type Receipt = "sent" | "delivered" | "seen";

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
  delivered: boolean;
  seenAt: string | null;
  receipt: Receipt;
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

export type Story = {
  id: number;
  userId: string;
  type: string;
  text: string;
  fileUrl: string | null;
  createdAt: string;
};

export type Room = {
  id: number;
  name: string;
  topic: string;
  photoUrl: string;
  ownerId: string;
  memberCount: number;
  joined: boolean;
  speakerOn: boolean;
  lastText: string;
  lastAt: string | null;
};

export type RoomMessage = {
  id: number;
  roomId: number;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  type: string;
  text: string;
  fileUrl: string | null;
  durationSec: number;
  createdAt: string;
  system: boolean;
};

export type ReportRow = {
  id: number;
  kind: string;
  reporterId: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  reason: string;
  snippet: string;
  messageId: number | null;
  roomId: number | null;
  roomMessageId: number | null;
  peerA: string;
  peerB: string;
  status: string;
  createdAt: string;
};

export type VerifyRequest = {
  id: number;
  userId: string;
  name: string;
  photoUrl: string;
  note: string;
  status: string;
  createdAt: string;
};

export type AdminMail = {
  id: number;
  userId: string;
  name: string;
  photoUrl: string;
  body: string;
  status: string;
  createdAt: string;
};
