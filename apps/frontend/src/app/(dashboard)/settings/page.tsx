"use client";

import { useState, useEffect } from "react";
import apiClient from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function SettingsPage() {
  const [isLinked, setIsLinked] = useState<boolean | null>(null);
  const [phone, setPhone] = useState("");
  const [inputPhone, setInputPhone] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState(1); // 1 = input phone, 2 = input code
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await apiClient.get("/api/telegram/status");
        if (res.data.isLinked) {
          setIsLinked(true);
          setPhone(res.data.phone);
        } else {
          setIsLinked(false);
        }
      } catch (err) {
        setIsLinked(false);
      }
    }
    checkStatus();
  }, []);

  const handleSendCode = async () => {
    if (!inputPhone) return;
    setLoading(true);
    try {
      const res = await apiClient.post("/api/telegram/auth/send-code", {
        phoneNumber: inputPhone,
      });
      setPhoneCodeHash(res.data.phoneCodeHash);
      setStep(2);
      showToast("Verification code sent to your Telegram app", "success");
    } catch (error: any) {
      showToast(
        error.response?.data?.error || "Failed to send code",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code) return;
    setLoading(true);
    try {
      await apiClient.post("/api/telegram/auth/verify-code", {
        phoneNumber: inputPhone,
        phoneCodeHash,
        code,
      });
      showToast("Telegram account linked successfully!", "success");
      setIsLinked(true);
      setPhone(inputPhone);
      setStep(1);
    } catch (error: any) {
      showToast(
        error.response?.data?.error || "Invalid OTP or verification failed",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  if (isLinked === null) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Settings</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Telegram Integration
        </h2>

        {isLinked ? (
          <div className="flex items-center gap-3 rounded-md bg-green-50 p-4 text-green-700">
            <svg
              className="h-5 w-5 text-green-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium">
              ✅ Connected to Telegram as {phone}
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Link your Telegram account to sync messages directly into EmailHub.
            </p>

            {step === 1 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Phone Number (with country code, e.g., +8498...)
                </label>
                <input
                  type="text"
                  value={inputPhone}
                  onChange={(e) => setInputPhone(e.target.value)}
                  placeholder="+1234567890"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm placeholder-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  disabled={loading}
                />
                <button
                  onClick={handleSendCode}
                  disabled={!inputPhone || loading}
                  className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400"
                >
                  {loading ? "Sending..." : "Send Code"}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Verification Code (from Telegram app)
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="12345"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  disabled={loading}
                />
                <button
                  onClick={handleVerifyCode}
                  disabled={!code || loading}
                  className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-indigo-400"
                >
                  {loading ? "Verifying..." : "Verify Code"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
