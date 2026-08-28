import type {
  ChangePasswordInput,
  UpdateOwnProfileInput,
  UserProfile,
} from "@electronic-erp/contracts";
import { apiFetch } from "@/lib/api";
import { authStorage } from "./auth-service";

function token(): string {
  const t = authStorage.getToken();
  if (!t) throw new Error("Not authenticated");
  return t;
}

export type OwnProfileResponse = {
  user: UserProfile;
  permissions: string[];
  branches: string[];
  organizationId?: string;
  branchId?: string | null;
  roleNames?: string[];
  lastLoginAt?: string | null;
  branchName?: string | null;
};

export const profileApi = {
  me(): Promise<OwnProfileResponse> {
    const t = authStorage.getToken();
    if (!t) return Promise.reject(new Error("Not authenticated"));
    return apiFetch<OwnProfileResponse>("/api/v1/auth/me", { token: t });
  },
  update(input: UpdateOwnProfileInput) {
    return apiFetch<{ user: UserProfile }>("/api/v1/auth/me", {
      method: "PATCH",
      token: token(),
      body: JSON.stringify(input),
    });
  },
  changePassword(input: ChangePasswordInput) {
    return apiFetch<{ ok: boolean }>("/api/v1/auth/change-password", {
      method: "POST",
      token: token(),
      body: JSON.stringify(input),
    });
  },
};
