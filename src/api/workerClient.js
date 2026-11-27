export const workerPreview = import.meta.env.VITE_SYNCSONIC_WORKER_PREVIEW === "true";

export async function workerRequest(path, payload, method = payload === undefined ? "GET" : "POST") {
  const response = await fetch(`/api/v1/${path}`, {
    credentials: "same-origin",
    method,
    ...(payload === undefined ? {} : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error = new Error(data?.error || "Serviciul SyncSonic nu este disponibil.");
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function workerAuthenticated() {
  try {
    await workerRequest("account/session");
    return true;
  } catch (error) {
    if (error.status === 401) return false;
    throw error;
  }
}
