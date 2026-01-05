import axios from "axios";
import { signOut } from "next-auth/react";

export const apiClient = axios.create({
  baseURL: "",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    // Handle 401 Unauthorized - token expired or invalid
    if (status === 401) {
      // Sign out and redirect to home page (which shows sign-in card)
      await signOut({ redirect: false });
      window.location.href = "/";

      return Promise.reject({
        ...error,
        message: "Your session has expired. Please sign in again.",
        isAuthError: true,
      });
    }

    // Handle 403 Forbidden - insufficient permissions
    if (status === 403) {
      return Promise.reject({
        ...error,
        message: "You don't have permission to perform this action.",
        isForbiddenError: true,
      });
    }

    return Promise.reject(error);
  }
);

export default apiClient;
