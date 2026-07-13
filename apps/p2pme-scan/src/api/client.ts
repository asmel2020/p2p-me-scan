import axios from "axios";

const apiClient = axios.create({
  baseURL:
    "https://p2p-api.qiqinovels.workers.dev/v1" /* import.meta.env.VITE_API_URL || 'http://localhost:8787/v1', */,
});

export default apiClient;
