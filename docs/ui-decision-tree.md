# Folio — Complete UI State Machine

## Application Flow

```
┌──────────┐    click Reader     ┌────────────────┐    ≥1 page      ┌───────────────┐
│   HOME   │ ──────────────────> │  READER_CAPTURE │ ────────────>  │  READER_PLAY   │
│          │    click Tutor      ├────────────────┤                 └───────────────┘
│  QR code │ ──────────────────> │  TUTOR_CAPTURE  │
│  Reader  │                     │  (0 pages)      │
│  Tutor   │                     └────────┬───────┘
└──────────┘                              │ ≥1 page done
                                          ▼
                                ┌────────────────┐    Start Chat     ┌──────────────┐
                                │ TUTOR_READY     │ ───────────────> │  TUTOR_CHAT  │
                                │ (pages + capture)│ <─── + Pages ── │  (Q&A mode)  │
                                └────────────────┘                   └──────────────┘
```

---

## 1. HOME

### Entry conditions
- App loaded at `/`
- OR user clicked "Exit" from any mode
- OR page refresh on `/`

### UI Elements

| Element          | Visible | Enabled | Notes |
|------------------|---------|---------|-------|
| "folio" heading  | YES     | -       | Large typography |
| Description text | YES     | -       | |
| Reader button    | YES     | YES     | Creates session + navigates |
| Tutor button     | YES     | YES     | Creates session + navigates |
| QR code (phone)  | YES     | -       | Shows LAN IP URL |
| Error display    | HIDDEN  | -       | Appears on API failure |
| Loading state    | HIDDEN  | -       | Appears during session creation |
| Footer           | YES     | -       | |

### Transitions

| Action | From State | To State | Steps |
|--------|-----------|----------|-------|
| Click Reader | HOME | READER_CAPTURE | POST /api/session → store session_id → navigate /reader?session=ID |
| Click Tutor | HOME | TUTOR_CAPTURE | POST /api/session → store session_id → navigate /tutor?session=ID |
| Join active session | HOME | READER/TUTOR | Click "Join session" → navigate /{mode}?session=ID (reuses existing session) |
| Scan QR (phone) | HOME | AUTO_JOIN | Phone opens URL with ?join=1 → auto-redirects to most recent active session |
| Scan QR (no active) | HOME | HOME (on phone) | Phone opens URL with ?join=1 but no sessions exist → shows normal HOME |

### Error States

| Error | Trigger | Display | Recovery |
|-------|---------|---------|----------|
| Backend down | POST /api/session fails | "Connection failed: {error}" inline | Retry by clicking button again |
| Network error | fetch throws | "Connection failed: {error}" inline | Check backend is running |

### Page Refresh
- QR code recalculated from /api/network-info
- No session state to preserve (stateless page)

---

## 2. READER_CAPTURE

### Entry conditions
- Navigated from HOME via Reader button
- URL: `/reader?session=SESSION_ID`

### UI Elements

| Element          | Visible | Enabled | Notes |
|------------------|---------|---------|-------|
| Header (folio + Reader badge) | YES | - | |
| Status text      | YES     | -       | "Scan a page to begin" |
| Camera button    | YES     | YES     | getUserMedia (desktop) or Take Photo (mobile) |
| Upload button    | YES     | YES     | File picker |
| Page strip       | HIDDEN  | -       | No pages yet |
| Audio player     | HIDDEN  | -       | No audio yet |
| Processing spinner | HIDDEN | -      | Shows during page processing |
| Exit link        | YES     | YES     | Back to HOME |

### Transitions

| Action | To State | Steps |
|--------|----------|-------|
| Capture photo | READER_CAPTURE (pending) | Show spinner + "Reading the page..." → SSE progress → page_complete → TTS → READER_PLAY |
| Upload file | READER_CAPTURE (pending) | Same as capture |
| Exit | HOME | Navigate to / |

### Cross-device
- Pages added from phone via session sync (3s poll)
- New pages appear in page strip automatically

---

## 3. READER_PLAY

### Entry conditions
- ≥1 page successfully processed
- Audio generated and playing

### UI Elements

| Element          | Visible | Enabled | Notes |
|------------------|---------|---------|-------|
| Status text      | YES     | -       | "Listening. Tap a page to replay." |
| Camera button    | YES     | YES     | Capture next page |
| Page strip       | YES     | YES     | Click to replay audio |
| Audio visualizer | YES     | -       | Bounce bars during playback |
| Narration preview | YES    | -       | First 200 chars of active page narration |
| Processing spinner | HIDDEN | -      | |

### Transitions

| Action | To State | Steps |
|--------|----------|-------|
| Capture another page | READER_CAPTURE (pending) | Process in background, auto-play when done |
| Click page in strip | READER_PLAY | Replay TTS for that page |
| Audio ends | READER_PLAY | Status: "Tap a page to replay" |
| Exit | HOME | Navigate to / |

---

## 4. TUTOR_CAPTURE (0 completed pages)

### Entry conditions
- Navigated from HOME via Tutor button
- OR returned from TUTOR_CHAT via "+ Pages"

### UI Elements

| Element          | Visible | Enabled | Notes |
|------------------|---------|---------|-------|
| Header (folio + tutor badge) | YES | - | |
| Page count badge | HIDDEN  | -       | No pages yet |
| + Pages button   | HIDDEN  | -       | Only in chat mode |
| QR toggle button | YES     | YES     | Show session QR |
| QR panel         | HIDDEN  | -       | Toggled by button |
| Page strip       | HIDDEN  | -       | No pages |
| "Scan your textbook" heading | YES | - | |
| Camera/Take Photo | YES    | YES     | Primary action |
| Upload button    | YES     | YES     | |
| PDF Upload zone  | YES     | YES     | Only when 0 pages |
| Start Chat button | HIDDEN | -       | No pages to chat about |
| Exit link        | YES     | YES     | |

### Transitions

| Action | To State | Steps |
|--------|----------|-------|
| Take Photo | TUTOR_CAPTURE (pending) | Show pending thumbnail, upload in background |
| Upload file | TUTOR_CAPTURE (pending) | Same |
| Upload PDF | TUTOR_CAPTURE (pending) | Process all pages, show progress |
| Toggle QR | Same state + QR panel | Show/hide QR panel |

---

## 5. TUTOR_CAPTURE (pending, 0 completed)

### UI Elements — changes from above

| Element          | Visible | Enabled | Notes |
|------------------|---------|---------|-------|
| Page strip       | YES     | -       | Shows pending thumbnails with spinners |
| Status text      | YES     | -       | "Processing X pages... keep capturing" |
| Camera/Take Photo | YES   | YES     | Can capture in parallel |
| Start Chat button | HIDDEN | -       | Still no completed pages |
| PDF Upload zone  | HIDDEN | -       | Processing already |

---

## 6. TUTOR_READY (≥1 completed page)

### UI Elements — changes from TUTOR_CAPTURE

| Element          | Visible | Enabled | Notes |
|------------------|---------|---------|-------|
| Page count badge | YES     | -       | "N pages" |
| Page strip       | YES     | YES     | Click to highlight, completed + pending |
| Camera/Take Photo | YES   | YES     | Add more pages |
| PDF Upload zone  | HIDDEN | -       | Already have pages |
| Start Chat button | YES   | YES     | "Start asking questions (N pages)" |
| Status text      | YES     | -       | "N pages ready. Add more or start chatting." |

### When `cameFromChat` is true

| Element          | Change |
|------------------|--------|
| Start Chat button label | "Back to chat (N pages)" |

---

## 7. TUTOR_CHAT

### Entry conditions
- Clicked "Start Chat" from TUTOR_READY
- OR clicked "Back to Chat" from CAPTURE_FROM_CHAT

### UI Elements

| Element          | Visible | Enabled | Notes |
|------------------|---------|---------|-------|
| Page count badge | YES     | -       | |
| + Pages button (header) | YES | YES | Goes to CAPTURE_FROM_CHAT |
| QR toggle button | YES     | YES     | Phone can still add pages |
| Page strip       | YES     | YES     | Reference while chatting |
| Chat messages    | YES     | -       | User + assistant messages |
| Empty state text | YES (if 0 msgs) | - | "Ask anything about your captured pages" |
| Chat input       | YES     | YES     | Primary action |
| Camera icon (input area) | YES | YES | Quick access to capture mode |
| Send button      | YES     | ENABLED if input has text | |
| Loading dots     | HIDDEN  | -       | Shows while waiting for answer |
| Citation buttons | Per message | YES | Click to highlight page in strip |

### Transitions

| Action | To State | Steps |
|--------|----------|-------|
| Type + Send | TUTOR_CHAT | POST /api/ask SSE → show answer |
| Click + Pages | TUTOR_CAPTURE (cameFromChat=true) | Preserve chat history |
| Click camera icon | TUTOR_CAPTURE (cameFromChat=true) | Same as above |
| Click citation | TUTOR_CHAT | Highlight page in strip |
| Exit | HOME | Navigate to / |

### New pages arriving (cross-device)

| Event | Effect |
|-------|--------|
| Phone captures page | Page appears in strip (3s poll), joins Q&A context |
| No notification to user | Silent addition — next question will include new page |

---

## Cross-Device Coordination

### Scenario: Mac starts, Phone joins

```
Mac: HOME → click Tutor → TUTOR_CAPTURE
Mac: toggle QR → shows session URL QR
Phone: scan QR → opens /tutor?session=SAME_ID
Phone: Take Photo → uploaded to backend
Mac: poll detects new page → appears in page strip
Mac: Start Chat → asks questions about phone-captured pages
```

### Scenario: Phone captures, Mac chats

```
Phone: TUTOR_CAPTURE → Take Photo × 5
Mac: TUTOR_CHAT → sees 5 pages in strip (via poll)
Mac: asks "What is cell theory?" → answer from phone-captured pages
Phone: Take Photo × 2 more
Mac: asks follow-up → now uses 7 pages
```

### Scenario: Page refresh on either device

| Device | URL has session= | Backend has session | Result |
|--------|-----------------|---------------------|--------|
| Either | YES | YES | Reload pages from /api/session/{id}/pages, restore state |
| Either | YES | NO (backend restarted) | "Session not found" error → Go Home |
| Either | NO | - | "No session ID" error → Go Home |

### Scenario: Two phones, one Mac

- Both phones scan same QR → both join same session
- Both can capture pages → all pages pool together
- Mac sees all pages from both phones
- No conflict handling needed (pages append, never overwrite)

---

## Error States (Global)

| Error | Where | Display | Recovery |
|-------|-------|---------|----------|
| Backend unreachable | Any API call | Inline error message | Check if backend is running on port 8001 |
| Session expired | Any session endpoint | "Session not found" → Go Home | Create new session |
| Camera denied | CameraCapture | Error message + "Take Photo" / "Upload" fallbacks | Browser settings or use fallback |
| Camera not available (HTTP) | CameraCapture on mobile | "Take Photo" button (uses input capture) | Works without getUserMedia |
| No camera hardware | CameraCapture | "No camera found" + Upload button | Use file upload |
| Ollama down | Vision/Ask call | SSE stream error (currently unhandled) | Restart Ollama |
| Image too large | Upload | Timeout (currently unhandled) | Resize image |

---

## Feature Enable/Disable Summary

| Feature | HOME | R_CAPTURE | R_PLAY | T_CAPTURE(0) | T_PENDING | T_READY | T_CHAT |
|---------|------|-----------|--------|--------------|-----------|---------|--------|
| Reader btn | YES | - | - | - | - | - | - |
| Tutor btn | YES | - | - | - | - | - | - |
| Camera | - | YES | YES | YES | YES | YES | via btn |
| Upload | - | YES | YES | YES | YES | YES | via btn |
| PDF Upload | - | - | - | YES | NO | NO | NO |
| Start Chat | - | - | - | NO | NO | YES | - |
| Send msg | - | - | - | - | - | - | YES |
| +Pages | - | - | - | - | - | - | YES |
| Page strip | - | NO | YES | NO | YES | YES | YES |
| QR toggle | - | - | - | YES | YES | YES | YES |
| Audio play | - | - | YES | - | - | - | - |
| Exit | - | YES | YES | YES | YES | YES | YES |
