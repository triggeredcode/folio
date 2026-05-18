const API_URL = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");

export interface SessionResponse {
  session_id: string;
  mode: string;
  lang: string;
}

export interface PageData {
  page_id: string;
  page_number: number;
  text: string;
  headings: { level: number; text: string }[];
  diagrams: { id: string; label: string; description: string; labels: string[] }[];
  captions: string[];
  narration_text: string;
}

export interface AskResponse {
  answer: string;
  citations: { page: number }[];
  not_in_book: boolean;
  pages_used: number[];
}

export interface TopicsResponse {
  topics: string[];
  questions: string[];
  page_count: number;
}

export async function createSession(
  mode: "reader" | "tutor",
  lang = "en"
): Promise<SessionResponse> {
  const res = await fetch(`${API_URL}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, lang }),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  return res.json();
}

export async function getSession(sessionId: string) {
  const res = await fetch(`${API_URL}/api/session/${sessionId}`);
  if (!res.ok) throw new Error(`Session not found: ${res.status}`);
  return res.json();
}

export async function getSessionPages(sessionId: string): Promise<{ page_count: number; pages: PageData[] }> {
  const res = await fetch(`${API_URL}/api/session/${sessionId}/pages`);
  if (!res.ok) throw new Error(`Failed to fetch pages: ${res.status}`);
  return res.json();
}

export function ingestPageSSE(
  sessionId: string,
  pageNumber: number,
  imageBlob: Blob,
  onEvent: (event: string, data: string) => void
): AbortController {
  const controller = new AbortController();
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("page_number", pageNumber.toString());
  formData.append("image", imageBlob, "page.jpg");

  fetch(`${API_URL}/api/page`, {
    method: "POST",
    body: formData,
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      onEvent("error", JSON.stringify({ message: `Upload failed: ${res.status}` }));
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "message";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          onEvent(currentEvent, line.slice(5).trim());
        }
      }
    }
  }).catch(err => {
    if (err.name !== "AbortError") {
      onEvent("error", JSON.stringify({ message: err.message || "Network error" }));
    }
  });

  return controller;
}

export function ingestPdfSSE(
  sessionId: string,
  pdfBlob: Blob,
  onEvent: (event: string, data: string) => void,
  startPage = 1,
  endPage = -1
): AbortController {
  const controller = new AbortController();
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("pdf", pdfBlob, "document.pdf");
  formData.append("start_page", startPage.toString());
  formData.append("end_page", endPage.toString());

  fetch(`${API_URL}/api/pdf`, {
    method: "POST",
    body: formData,
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      onEvent("error", JSON.stringify({ message: `PDF upload failed: ${res.status}` }));
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "message";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          onEvent(currentEvent, line.slice(5).trim());
        }
      }
    }
  }).catch(err => {
    if (err.name !== "AbortError") {
      onEvent("error", JSON.stringify({ message: err.message || "Network error" }));
    }
  });

  return controller;
}

export async function getTopics(
  sessionId: string,
  selectedPages?: number[]
): Promise<TopicsResponse> {
  const res = await fetch(`${API_URL}/api/session/${sessionId}/topics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selected_pages: selectedPages }),
  });
  if (!res.ok) throw new Error(`Failed to fetch topics: ${res.status}`);
  return res.json();
}

export function getPageImageUrl(sessionId: string, pageNumber: number): string {
  return `${API_URL}/api/session/${sessionId}/page/${pageNumber}/image`;
}

export function askQuestionSSE(
  sessionId: string,
  question: string,
  onEvent: (event: string, data: string) => void,
  selectedPages?: number[]
): AbortController {
  const controller = new AbortController();

  fetch(`${API_URL}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, question, selected_pages: selectedPages }),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) {
      onEvent("error", JSON.stringify({ message: `Question failed: ${res.status}` }));
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "message";
      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          onEvent(currentEvent, line.slice(5).trim());
        }
      }
    }
  }).catch(err => {
    if (err.name !== "AbortError") {
      onEvent("error", JSON.stringify({ message: err.message || "Network error" }));
    }
  });

  return controller;
}

export function getAudioUrl(filename: string): string {
  return `${API_URL}/api/audio/${filename}`;
}

export async function generateTTS(text: string, voice = "samantha"): Promise<string> {
  const res = await fetch(`${API_URL}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
