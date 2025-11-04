import axios from 'axios';

// Create an axios instance with default config
export const apiClient = axios.create({
  timeout: 10000, // 10 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for handling common headers
apiClient.interceptors.request.use((config) => {
  // You can add auth headers or other common headers here
  return config;
});

// Add response interceptor for handling common errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log errors or handle common error cases
    console.error('API request failed:', error.message);
    return Promise.reject(error);
  }
);