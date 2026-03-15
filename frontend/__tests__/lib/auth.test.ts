import { describe, it, expect, beforeEach } from "vitest";

import { useAuthStore } from "@/stores/auth-store";

describe("AuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  });

  it("should set user and token on login", () => {
    const user = {
      id: 1,
      student_id: "2022141461001",
      name: "Test",
      campus: null,
      major: null,
      grade: null,
    };
    useAuthStore.getState().setUser(user, "test-token");

    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe("test-token");
  });

  it("should clear state on logout", () => {
    const user = {
      id: 1,
      student_id: "2022141461001",
      name: "Test",
      campus: null,
      major: null,
      grade: null,
    };
    useAuthStore.getState().setUser(user, "test-token");
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
