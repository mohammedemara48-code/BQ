import type { Intent, Role } from "./types";

export type CommunitySeed = {
  id: string;
  name: string;
  bio: string;
  pronouns: string;
  city: string;
  lookingFor: string;
  interests: string[];
  photoUrl: string;
  online: boolean;
  role: Role;
  intent: Intent;
  latitude: number;
  longitude: number;
  hasPrivatePhotos: boolean;
  replies: string[];
};

/** Demo people were removed — the directory is real accounts only. */
export const COMMUNITY: CommunitySeed[] = [];

export function communityById(_id: string): CommunitySeed | undefined {
  return undefined;
}

export function isCommunityId(_id: string): boolean {
  return false;
}
