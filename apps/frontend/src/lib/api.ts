import axios from "axios";

export const apiClient = axios.create({
  baseURL: "",

  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;
