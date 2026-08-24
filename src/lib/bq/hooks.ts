import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  blockUser,
  getMe,
  getPerson,
  grantPrivate,
  listCalls,
  listChats,
  listMembers,
  listMessages,
  listNotices,
  listPeople,
  listRequests,
  logCall,
  markNoticesRead,
  openViewOnce,
  removeMember,
  replyFromPeer,
  reportUser,
  requestPrivate,
  respondRequest,
  sendMessage,
  sendRequest,
  unfriend,
  updateMe,
} from "./server";
import { COMMUNITY, isCommunityId } from "./community";
import type { MsgType, Profile } from "./types";

export function useMe(enabled = true) {
  return useQuery({ queryKey: ["me"], queryFn: () => getMe(), enabled });
}

export function usePeople(enabled = true) {
  return useQuery({ queryKey: ["people"], queryFn: () => listPeople(), enabled });
}

export function usePerson(id: string, enabled = true) {
  return useQuery({
    queryKey: ["person", id],
    queryFn: () => getPerson({ data: { id } }),
    enabled: enabled && Boolean(id),
  });
}

export function useChats(enabled = true) {
  return useQuery({
    queryKey: ["chats"],
    queryFn: () => listChats(),
    refetchInterval: enabled ? 4000 : false,
    enabled,
  });
}

export function useRequests(enabled = true) {
  return useQuery({
    queryKey: ["requests"],
    queryFn: () => listRequests(),
    refetchInterval: enabled ? 6000 : false,
    enabled,
  });
}

export function useCalls() {
  return useQuery({ queryKey: ["calls"], queryFn: () => listCalls() });
}

export function useMembers(enabled = false) {
  return useQuery({
    queryKey: ["members"],
    queryFn: () => listMembers(),
    enabled,
  });
}

export function useNotices(enabled = true) {
  return useQuery({
    queryKey: ["notices"],
    queryFn: () => listNotices(),
    refetchInterval: enabled ? 5000 : false,
    enabled,
  });
}

export function useMessages(peerId: string) {
  return useQuery({
    queryKey: ["messages", peerId],
    queryFn: () => listMessages({ data: { peerId } }),
    enabled: Boolean(peerId),
    refetchInterval: 2200,
  });
}

type ProfilePatch = {
  name?: string;
  bio?: string;
  pronouns?: string;
  city?: string;
  lookingFor?: string;
  interests?: string[];
  photoUrl?: string;
  coverUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  role?: Profile["role"];
  intent?: Profile["intent"];
  phone?: string;
  showOnMap?: boolean;
  gallery?: string[];
  privateGallery?: string[];
};

export function useBqMutations() {
  const qc = useQueryClient();
  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["chats"] });
    void qc.invalidateQueries({ queryKey: ["messages"] });
    void qc.invalidateQueries({ queryKey: ["people"] });
    void qc.invalidateQueries({ queryKey: ["requests"] });
    void qc.invalidateQueries({ queryKey: ["calls"] });
    void qc.invalidateQueries({ queryKey: ["me"] });
    void qc.invalidateQueries({ queryKey: ["members"] });
    void qc.invalidateQueries({ queryKey: ["notices"] });
    void qc.invalidateQueries({ queryKey: ["person"] });
  };

  const send = useMutation({
    mutationFn: (input: {
      peerId: string;
      text: string;
      type?: MsgType;
      fileUrl?: string | null;
      viewOnce?: boolean;
      durationSec?: number;
    }) =>
      sendMessage({
        data: {
          peerId: input.peerId,
          text: input.text,
          type: input.type ?? "text",
          fileUrl: input.fileUrl,
          viewOnce: input.viewOnce,
          durationSec: input.durationSec,
        },
      }),
    onSuccess: async (_res, vars) => {
      await qc.invalidateQueries({ queryKey: ["messages", vars.peerId] });
      await qc.invalidateQueries({ queryKey: ["chats"] });
      if (isCommunityId(vars.peerId) && vars.type === "text") {
        window.setTimeout(() => {
          void replyFromPeer({ data: { peerId: vars.peerId } }).then(() => {
            void qc.invalidateQueries({ queryKey: ["messages", vars.peerId] });
            void qc.invalidateQueries({ queryKey: ["chats"] });
          });
        }, 900);
      }
    },
  });

  const request = useMutation({
    mutationFn: (peerId: string) => sendRequest({ data: { peerId } }),
    onSuccess: invalidateAll,
  });

  const respond = useMutation({
    mutationFn: (input: { id: number; accept: boolean }) =>
      respondRequest({ data: input }),
    onSuccess: invalidateAll,
  });

  const saveMe = useMutation({
    mutationFn: (patch: ProfilePatch) => updateMe({ data: patch }),
    onSuccess: (me) => {
      qc.setQueryData(["me"], me);
    },
  });

  const reveal = useMutation({
    mutationFn: (id: number) => openViewOnce({ data: { id } }),
    onSuccess: invalidateAll,
  });

  const recordCall = useMutation({
    mutationFn: (input: {
      peerId: string;
      kind: "audio" | "video";
      durationSec: number;
    }) =>
      logCall({
        data: {
          peerId: input.peerId,
          kind: input.kind,
          direction: "out",
          durationSec: input.durationSec,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calls"] }),
  });

  const kick = useMutation({
    mutationFn: (userId: string) => removeMember({ data: { userId } }),
    onSuccess: invalidateAll,
  });

  const block = useMutation({
    mutationFn: (userId: string) => blockUser({ data: { userId } }),
    onSuccess: invalidateAll,
  });

  const dropFriend = useMutation({
    mutationFn: (userId: string) => unfriend({ data: { userId } }),
    onSuccess: invalidateAll,
  });

  const report = useMutation({
    mutationFn: (input: { userId: string; reason: string }) =>
      reportUser({ data: input }),
    onSuccess: invalidateAll,
  });

  const askPrivate = useMutation({
    mutationFn: (ownerId: string) => requestPrivate({ data: { ownerId } }),
    onSuccess: invalidateAll,
  });

  const allowPrivate = useMutation({
    mutationFn: (input: { viewerId: string; accept: boolean }) =>
      grantPrivate({ data: input }),
    onSuccess: invalidateAll,
  });

  const readNotices = useMutation({
    mutationFn: () => markNoticesRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notices"] }),
  });

  return {
    send,
    request,
    respond,
    saveMe,
    reveal,
    recordCall,
    kick,
    block,
    dropFriend,
    report,
    askPrivate,
    allowPrivate,
    readNotices,
  };
}

export function findPerson(
  people: Profile[] | undefined,
  me: Profile | undefined,
  id: string,
): Profile | undefined {
  if (me && me.userId === id) return me;
  const hit = people?.find((p) => p.userId === id);
  if (hit) return hit;
  const seed = COMMUNITY.find((p) => p.id === id);
  if (!seed) return undefined;
  return {
    userId: seed.id,
    name: seed.name,
    bio: seed.bio,
    pronouns: seed.pronouns,
    city: seed.city,
    lookingFor: seed.lookingFor,
    interests: seed.interests,
    photoUrl: seed.photoUrl,
    coverUrl: "",
    online: seed.online,
    isCommunity: true,
    isAdmin: false,
    role: seed.role,
    intent: seed.intent,
    phone: "",
    showOnMap: true,
    gallery: seed.photoUrl ? [seed.photoUrl] : [],
    privateGallery: [],
    hasPrivate: seed.hasPrivatePhotos,
    privateGranted: false,
    distanceKm: null,
  };
}
