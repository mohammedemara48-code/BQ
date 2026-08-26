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
  reportUser,
  requestPrivate,
  respondRequest,
  sendMessage,
  sendRequest,
  unfriend,
  updateMe,
} from "./server";
import {
  addStory,
  adminListThread,
  acceptThread,
  blobStatus,
  closeAdminMail,
  contactAdmin,
  createRoom,
  decideVerify,
  deleteStory,
  getAdminBadge,
  joinRoom,
  leaveRoom,
  listAdminMail,
  listAdminReports,
  listRoomMessages,
  listRooms,
  listStories,
  listVerifyRequests,
  requestVerify,
  resolveReport,
  sendRoomMessage,
  setRoomSpeaker,
} from "./live";
import {
  answerCall,
  endCall,
  incomingCall,
  pollCall,
  postCallSignal,
} from "./call-live";
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

export function useStories(enabled = true) {
  return useQuery({
    queryKey: ["stories"],
    queryFn: () => listStories(),
    refetchInterval: enabled ? 8000 : false,
    enabled,
  });
}

export function useRooms(enabled = true) {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: () => listRooms(),
    refetchInterval: enabled ? 6000 : false,
    enabled,
  });
}

export function useRoomMessages(roomId: number, enabled = true) {
  return useQuery({
    queryKey: ["room-messages", roomId],
    queryFn: () => listRoomMessages({ data: { roomId } }),
    enabled: enabled && roomId > 0,
    refetchInterval: enabled ? 2200 : false,
  });
}

export function useAdminReports(enabled = false) {
  return useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => listAdminReports(),
    enabled,
    refetchInterval: enabled ? 8000 : false,
  });
}

export function useVerifyRequests(enabled = false) {
  return useQuery({
    queryKey: ["verify-requests"],
    queryFn: () => listVerifyRequests(),
    enabled,
    refetchInterval: enabled ? 8000 : false,
  });
}

export function useAdminMail(enabled = false) {
  return useQuery({
    queryKey: ["admin-mail"],
    queryFn: () => listAdminMail(),
    enabled,
    refetchInterval: enabled ? 8000 : false,
  });
}

export function useAdminThread(
  opts: { peerA?: string; peerB?: string; roomId?: number },
  enabled = false,
) {
  return useQuery({
    queryKey: ["admin-thread", opts],
    queryFn: () => adminListThread({ data: opts }),
    enabled,
  });
}

export function useAdminBadge(enabled = false) {
  return useQuery({
    queryKey: ["admin-badge"],
    queryFn: () => getAdminBadge(),
    enabled,
    refetchInterval: enabled ? 6000 : false,
  });
}

export function useBlobStatus(enabled = false) {
  return useQuery({
    queryKey: ["blob-status"],
    queryFn: () => blobStatus(),
    enabled,
  });
}

export function useIncomingCall(enabled = false) {
  return useQuery({
    queryKey: ["incoming-call"],
    queryFn: () => incomingCall(),
    enabled,
    refetchInterval: enabled ? 1000 : false,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useCallSession(callId: number | null) {
  return useQuery({
    queryKey: ["call-session", callId],
    queryFn: () => pollCall({ data: { callId: callId!, since: 0 } }),
    enabled: Boolean(callId),
    refetchInterval: callId ? 500 : false,
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
    void qc.invalidateQueries({ queryKey: ["stories"] });
    void qc.invalidateQueries({ queryKey: ["rooms"] });
    void qc.invalidateQueries({ queryKey: ["room-messages"] });
    void qc.invalidateQueries({ queryKey: ["admin-reports"] });
    void qc.invalidateQueries({ queryKey: ["verify-requests"] });
    void qc.invalidateQueries({ queryKey: ["admin-mail"] });
    void qc.invalidateQueries({ queryKey: ["admin-thread"] });
    void qc.invalidateQueries({ queryKey: ["admin-badge"] });
    void qc.invalidateQueries({ queryKey: ["incoming-call"] });
    void qc.invalidateQueries({ queryKey: ["call-session"] });
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
    mutationFn: (input: {
      userId: string;
      reason: string;
      kind?: "user" | "message" | "room" | "attachment";
      messageId?: number;
      roomId?: number;
      roomMessageId?: number;
      snippet?: string;
    }) => reportUser({ data: input }),
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

  const postStory = useMutation({
    mutationFn: (input: { type: "image" | "video" | "text"; text?: string; fileUrl?: string | null }) =>
      addStory({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stories"] }),
  });

  const dropStory = useMutation({
    mutationFn: (id: number) => deleteStory({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stories"] }),
  });

  const makeRoom = useMutation({
    mutationFn: (input: { name: string; topic?: string }) => createRoom({ data: input }),
    onSuccess: invalidateAll,
  });

  const enterRoom = useMutation({
    mutationFn: (roomId: number) => joinRoom({ data: { roomId } }),
    onSuccess: invalidateAll,
  });

  const exitRoom = useMutation({
    mutationFn: (roomId: number) => leaveRoom({ data: { roomId } }),
    onSuccess: invalidateAll,
  });

  const speaker = useMutation({
    mutationFn: (input: { roomId: number; on: boolean }) => setRoomSpeaker({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rooms"] }),
  });

  const sendRoom = useMutation({
    mutationFn: (input: {
      roomId: number;
      text: string;
      type?: MsgType;
      fileUrl?: string | null;
      durationSec?: number;
    }) =>
      sendRoomMessage({
        data: {
          roomId: input.roomId,
          text: input.text,
          type: input.type ?? "text",
          fileUrl: input.fileUrl,
          durationSec: input.durationSec,
        },
      }),
    onSuccess: async (_r, vars) => {
      await qc.invalidateQueries({ queryKey: ["room-messages", vars.roomId] });
      await qc.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const askVerify = useMutation({
    mutationFn: (note?: string) => requestVerify({ data: { note } }),
    onSuccess: invalidateAll,
  });

  const mailAdmin = useMutation({
    mutationFn: (body: string) => contactAdmin({ data: { body } }),
    onSuccess: invalidateAll,
  });

  const decideV = useMutation({
    mutationFn: (input: { id: number; accept: boolean }) => decideVerify({ data: input }),
    onSuccess: invalidateAll,
  });

  const closeMail = useMutation({
    mutationFn: (id: number) => closeAdminMail({ data: { id } }),
    onSuccess: invalidateAll,
  });

  const closeReport = useMutation({
    mutationFn: (input: { id: number; action: "dismiss" | "delete_message" | "remove_user" }) =>
      resolveReport({ data: input }),
    onSuccess: invalidateAll,
  });

  const acceptMsg = useMutation({
    mutationFn: (peerId: string) => acceptThread({ data: { peerId } }),
    onSuccess: invalidateAll,
  });

  const pickUp = useMutation({
    mutationFn: (callId: number) => answerCall({ data: { callId } }),
  });

  const hangLive = useMutation({
    mutationFn: (input: { callId: number; reason?: "hang" | "decline" }) =>
      endCall({ data: { callId: input.callId, reason: input.reason } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["calls"] });
      void qc.invalidateQueries({ queryKey: ["incoming-call"] });
      void qc.invalidateQueries({ queryKey: ["messages"] });
      void qc.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const sendSignal = useMutation({
    mutationFn: (input: { callId: number; kind: "offer" | "answer" | "ice"; payload: string }) =>
      postCallSignal({ data: input }),
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
    postStory,
    dropStory,
    makeRoom,
    enterRoom,
    exitRoom,
    speaker,
    sendRoom,
    askVerify,
    mailAdmin,
    decideV,
    closeMail,
    closeReport,
    acceptMsg,
    pickUp,
    hangLive,
    sendSignal,
  };
}

export function findPerson(
  people: Profile[] | undefined,
  me: Profile | undefined,
  id: string,
): Profile | undefined {
  if (me && me.userId === id) return me;
  return people?.find((p) => p.userId === id);
}
