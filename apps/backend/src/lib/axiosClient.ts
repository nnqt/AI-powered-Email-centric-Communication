import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { logger } from './logger';

/**
 * Normalize error response into a consistent format
 */
function normalizeError(error: AxiosError): Error {
  if (error.response) {
    // Server responded with error status
    return new Error(
      `API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
    );
  } else if (error.request) {
    // Request made but no response
    return new Error(
      `Network Error: ${error.code || 'NETWORK_ERROR'} - ${error.message}`
    );
  }
  // Something else went wrong
  return new Error(`Request Error: ${error.message}`);
}

// Get base URL from environment
const baseURL = process.env.AI_SERVICE_URL;
if (!baseURL) {
  throw new Error('AI_SERVICE_URL environment variable is not configured');
}

// Create axios instance with default config
export const axiosClient = axios.create({
  baseURL,
  timeout: 10000, // 10 seconds
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor for logging and common headers
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const requestId = Math.random().toString(36).substring(7);
    logger.debug(`[${requestId}] Request: ${config.method?.toUpperCase()} ${config.url}`, {
      headers: config.headers,
      data: config.data,
    });
    
    // Add request ID to headers for tracing
    config.headers['X-Request-ID'] = requestId;
    return config;
  },
  (error: AxiosError) => {
    logger.error('Request configuration error:', {error});
    return Promise.reject(normalizeError(error));
  }
);

// Response interceptor for logging and error handling
axiosClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const requestId = response.config.headers['X-Request-ID'];
    logger.debug(`[${requestId}] Response: ${response.status}`, {
      data: response.data,
    });
    return response;
  },
  (error: AxiosError) => {
    const requestId = error.config?.headers?.['X-Request-ID'];
    logger.error(`[${requestId}] Request failed:`, {error});
    return Promise.reject(normalizeError(error));
  }
);