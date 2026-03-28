export const isSandboxUiEnabled =
  process.env.NEXT_PUBLIC_ENABLE_SANDBOX_UI === "true" ||
  process.env.NODE_ENV === "development";
