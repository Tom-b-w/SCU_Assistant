import axios from "axios";

function resolveApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;

    if (!envUrl) {
      return `${protocol}//${hostname}:8000`;
    }

    try {
      const parsed = new URL(envUrl);
      const isLocalEnvHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      const isLocalPageHost = hostname === "localhost" || hostname === "127.0.0.1";

      if (isLocalEnvHost && isLocalPageHost && parsed.hostname !== hostname) {
        parsed.hostname = hostname;
        return parsed.toString().replace(/\/$/, "");
      }

      return parsed.toString().replace(/\/$/, "");
    } catch {
      return envUrl;
    }
  }

  return envUrl || "http://localhost:8000";
}

export const api = axios.create({
  baseURL: resolveApiUrl(),
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Lazy accessor to avoid circular dependency with auth-store
function getAuthStore() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/stores/auth-store").useAuthStore;
}

// Request interceptor: attach access token from Zustand store (in-memory)
api.interceptors.request.use((config) => {
  const token = getAuthStore().getState().accessToken;
  config.baseURL = resolveApiUrl();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 → try refresh, 403 SESSION_EXPIRED → re-login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const errorCode = error.response?.data?.error?.code;

    // 教务系统会话过期 — 清除登录态，跳转登录页
    if (status === 403 && errorCode === "SESSION_EXPIRED") {
      getAuthStore().getState().logout();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await api.post("/api/auth/refresh");
        getAuthStore().getState().setAccessToken(data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch {
        getAuthStore().getState().logout();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
