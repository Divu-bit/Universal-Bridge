# 🌉 Universal Notification Bridge

> **Send interactive push notifications to any phone from any backend — no app building required.**

Universal Bridge is a plug-and-play notification infrastructure that lets developers send native push notifications with **interactive forms** (buttons, text inputs, display text) to a mobile app. When users interact with the form, their response is sent as an HTTP webhook back to the developer's server.

**Live Server:** `https://universal-bridge.onrender.com`

---

## 📐 Architecture

```
┌──────────────────┐     POST /api/notify      ┌───────────────────┐
│                  │ ──────────────────────────▶│                   │
│  YOUR SERVER     │    (API Key + Schema)      │  BRIDGE SERVER    │
│  (any language)  │                            │  (Node.js/Express)│
│                  │◀────── POST webhook ───────│                   │
└──────────────────┘   (user's response)        └────────┬──────────┘
                                                         │
                                                         │ Expo Push API
                                                         ▼
                                                ┌───────────────────┐
                                                │   📱 MOBILE APP   │
                                                │  (React Native)   │
                                                │                   │
                                                │  Renders form     │
                                                │  from JSON schema │
                                                └───────────────────┘
```

---

## 🚀 Quick Start (3 Steps)

### Step 1 — Register as a Developer

```bash
curl -X POST https://universal-bridge.onrender.com/api/developers/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'
```

**Response:**
```json
{
  "message": "Developer registered",
  "apiKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

> ⚠️ Save this API key — you'll need it for every request.

---

### Step 2 — Get the Target User's ID

When a user installs the mobile app, they're auto-assigned an `appUserId`. You'll need this to target them.

**To get all registered users** (or have your own mapping logic):
The `appUserId` is generated when the app first launches and registers with the server.

---

### Step 3 — Send a Notification

```bash
curl -X POST https://universal-bridge.onrender.com/api/notify \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "targetUserId": "USER_ID_HERE",
    "title": "🚀 Deploy to Production?",
    "body": "Build #487 passed all tests.",
    "interactiveSchema": [
      {
        "type": "display_text",
        "label": "A new build is ready for production deployment."
      },
      {
        "type": "text_input",
        "id": "release_notes",
        "label": "Release notes"
      },
      {
        "type": "button",
        "label": "✅ Approve",
        "action": "approve",
        "webhookUrl": "https://your-server.com/webhook"
      },
      {
        "type": "button",
        "label": "❌ Deny",
        "action": "deny",
        "webhookUrl": "https://your-server.com/webhook"
      }
    ]
  }'
```

**What happens:**
1. User's phone receives a native push notification
2. User taps it → an interactive form renders inside the app
3. User fills in fields and taps a button
4. The app sends a `POST` to your `webhookUrl` with the user's response

---

## 📡 API Reference

### Base URL
```
https://universal-bridge.onrender.com
```

### Health Check
```
GET /
```
Returns: `{"status": "Universal Bridge Server is running"}`

---

### `POST /api/developers/register`

Register as a developer to receive an API key.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | ✅ | Your email address |

**Response:**
```json
{
  "message": "Developer registered",
  "apiKey": "uuid-v4-api-key"
}
```

---

### `POST /api/users/register`

Register a mobile app user (called automatically by the app on launch).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `appUserId` | string | ❌ | Existing user ID (for updates) |
| `pushToken` | string | ✅ | Expo push token from the device |

**Response:**
```json
{
  "message": "User created",
  "appUserId": "auto-generated-uuid",
  "pushToken": "ExponentPushToken[...]"
}
```

---

### `POST /api/notify`

Send an interactive push notification to a user.

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | ✅ | `application/json` |
| `x-api-key` | ✅ | Your developer API key |

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `targetUserId` | string | ✅ | The app user's ID |
| `title` | string | ✅ | Notification title (supports emoji) |
| `body` | string | ❌ | Notification body text |
| `interactiveSchema` | array | ❌ | JSON array of UI components |

**Response:**
```json
{
  "success": true,
  "messageId": { "data": { "status": "ok", "id": "..." } }
}
```

---

## 🧩 Interactive Schema Reference

The `interactiveSchema` is a JSON array of UI components that render inside the mobile app when the user opens the notification. The app dynamically builds a form from this schema.

### `display_text`

Shows a read-only text message to the user.

```json
{
  "type": "display_text",
  "label": "Your server has been running for 72 hours without issues."
}
```

### `text_input`

Renders a text input field. The user's input is included in the webhook payload under the `id` key.

```json
{
  "type": "text_input",
  "id": "comment",
  "label": "Add a comment"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✅ | Key name in the webhook `data` object |
| `label` | string | ✅ | Placeholder and label text |

### `button`

Renders a tappable button. When pressed, the app sends an HTTP POST to the specified `webhookUrl`.

```json
{
  "type": "button",
  "label": "✅ Approve",
  "action": "approve",
  "webhookUrl": "https://your-server.com/handle-action"
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `label` | string | ✅ | Button text (supports emoji) |
| `action` | string | ✅ | Action identifier sent in webhook payload |
| `webhookUrl` | string | ✅ | Your server endpoint to receive the response |

---

## 📬 Webhook Payload

When a user taps a button, the app sends a `POST` request to the button's `webhookUrl`:

```json
{
  "action": "approve",
  "data": {
    "comment": "Looks good, ship it!",
    "release_notes": "Bug fixes and performance improvements"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `action` | string | The `action` value from the button definition |
| `data` | object | Key-value pairs from all `text_input` fields |

---

## 💡 Use Case Examples

### 1. CI/CD Deployment Approval

```json
{
  "targetUserId": "user-123",
  "title": "🚀 Deploy v2.1.0?",
  "body": "All 142 tests passed.",
  "interactiveSchema": [
    { "type": "display_text", "label": "Branch: main → production" },
    { "type": "text_input", "id": "notes", "label": "Release notes" },
    { "type": "button", "label": "✅ Deploy", "action": "deploy", "webhookUrl": "https://ci.example.com/approve" },
    { "type": "button", "label": "❌ Reject", "action": "reject", "webhookUrl": "https://ci.example.com/approve" }
  ]
}
```

### 2. Smart Home Control

```json
{
  "targetUserId": "user-123",
  "title": "🏠 Motion Detected",
  "body": "Front door camera triggered.",
  "interactiveSchema": [
    { "type": "display_text", "label": "Motion detected at 3:45 PM at the front door." },
    { "type": "button", "label": "💡 Lights On", "action": "lights_on", "webhookUrl": "https://home.example.com/api" },
    { "type": "button", "label": "🔒 Lock Door", "action": "lock", "webhookUrl": "https://home.example.com/api" },
    { "type": "button", "label": "🚨 Alarm", "action": "alarm", "webhookUrl": "https://home.example.com/api" }
  ]
}
```

### 3. Study/Task Reminder

```json
{
  "targetUserId": "user-123",
  "title": "📚 Study Reminder",
  "body": "3 topics due for review today.",
  "interactiveSchema": [
    { "type": "display_text", "label": "Topics: React Hooks, Binary Trees, SQL Joins" },
    { "type": "text_input", "id": "new_topic", "label": "Add a new topic" },
    { "type": "button", "label": "✅ Mark Done", "action": "completed", "webhookUrl": "https://study.example.com/log" },
    { "type": "button", "label": "⏰ Snooze 1hr", "action": "snooze", "webhookUrl": "https://study.example.com/log" }
  ]
}
```

### 4. E-Commerce Order Approval

```json
{
  "targetUserId": "user-123",
  "title": "🛒 New Order #4892",
  "body": "$249.99 — Awaiting your approval.",
  "interactiveSchema": [
    { "type": "display_text", "label": "Customer: John Doe\nItems: 3x Widget Pro\nTotal: $249.99\nShipping: Express" },
    { "type": "text_input", "id": "note", "label": "Internal note" },
    { "type": "button", "label": "✅ Approve & Ship", "action": "approve_order", "webhookUrl": "https://shop.example.com/orders/webhook" },
    { "type": "button", "label": "❌ Cancel Order", "action": "cancel_order", "webhookUrl": "https://shop.example.com/orders/webhook" }
  ]
}
```

### 5. Server Monitoring Alert

```json
{
  "targetUserId": "user-123",
  "title": "⚠️ High CPU Alert",
  "body": "Server prod-web-03 at 94% CPU.",
  "interactiveSchema": [
    { "type": "display_text", "label": "CPU: 94% | Memory: 78% | Uptime: 14d 6h\nLast deploy: 2 hours ago" },
    { "type": "button", "label": "🔄 Restart Server", "action": "restart", "webhookUrl": "https://ops.example.com/server-action" },
    { "type": "button", "label": "📈 Scale Up", "action": "scale_up", "webhookUrl": "https://ops.example.com/server-action" },
    { "type": "button", "label": "🔕 Acknowledge", "action": "ack", "webhookUrl": "https://ops.example.com/server-action" }
  ]
}
```

---

## 🔧 Integration Examples

### Node.js / Express

```javascript
const axios = require('axios');

const BRIDGE_URL = 'https://universal-bridge.onrender.com';
const API_KEY = 'your-api-key';

async function sendNotification(userId, title, body, schema) {
  const res = await axios.post(`${BRIDGE_URL}/api/notify`, {
    targetUserId: userId,
    title,
    body,
    interactiveSchema: schema
  }, {
    headers: { 'x-api-key': API_KEY }
  });
  return res.data;
}

// Usage
sendNotification('user-123', '🔔 Action Needed', 'Please review.', [
  { type: 'display_text', label: 'A task requires your attention.' },
  { type: 'button', label: '✅ Done', action: 'done', webhookUrl: 'https://your-server.com/webhook' }
]);
```

### Python

```python
import requests

BRIDGE_URL = "https://universal-bridge.onrender.com"
API_KEY = "your-api-key"

def send_notification(user_id, title, body, schema):
    return requests.post(
        f"{BRIDGE_URL}/api/notify",
        json={
            "targetUserId": user_id,
            "title": title,
            "body": body,
            "interactiveSchema": schema
        },
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY
        }
    ).json()

# Usage
send_notification("user-123", "🔔 Alert", "Server needs attention.", [
    {"type": "display_text", "label": "CPU usage is at 95%."},
    {"type": "button", "label": "🔄 Restart", "action": "restart", "webhookUrl": "https://your-server.com/webhook"},
    {"type": "button", "label": "🔕 Ignore", "action": "ignore", "webhookUrl": "https://your-server.com/webhook"}
])
```

### cURL (Any Language / Shell Script)

```bash
curl -X POST https://universal-bridge.onrender.com/api/notify \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "targetUserId": "user-123",
    "title": "📦 Package Delivered",
    "body": "Your order has arrived.",
    "interactiveSchema": [
      {"type": "display_text", "label": "Package left at front door."},
      {"type": "button", "label": "👍 Received", "action": "received", "webhookUrl": "https://your-server.com/webhook"}
    ]
  }'
```

### AI Agent Integration

AI agents can use this as a **human-in-the-loop** tool to get real-time approvals:

```python
# AI Agent asks for human approval before executing a risky action
def request_human_approval(action_description, approve_url):
    send_notification(
        user_id="admin-user-id",
        title="🤖 AI Agent Needs Approval",
        body=f"Agent wants to: {action_description}",
        schema=[
            {"type": "display_text", "label": f"The AI agent is requesting permission to: {action_description}"},
            {"type": "text_input", "id": "instructions", "label": "Additional instructions for the agent"},
            {"type": "button", "label": "✅ Approve", "action": "approve", "webhookUrl": approve_url},
            {"type": "button", "label": "❌ Deny", "action": "deny", "webhookUrl": approve_url}
        ]
    )
```

---

## 🗂 Project Structure

```
Universal-Bridge/
├── bridge-server/              # Backend API (Node.js/Express)
│   ├── index.js                # Server entry point, routes, webhook handler
│   ├── firebase.js             # Firebase Admin SDK initialization
│   ├── models/
│   │   ├── Developer.js        # Developer schema (email, apiKey)
│   │   └── AppUser.js          # App user schema (appUserId, pushToken)
│   ├── routes/
│   │   ├── developer.js        # POST /api/developers/register
│   │   ├── appUser.js          # POST /api/users/register
│   │   └── notify.js           # POST /api/notify (main notification endpoint)
│   ├── package.json
│   └── .env                    # Local env vars (not in repo)
│
├── mobile-app/                 # React Native / Expo mobile app
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx       # Home screen - token display & notification UI
│   │   │   └── explore.tsx     # Explore tab
│   │   └── _layout.tsx         # Root layout with theme provider
│   ├── components/
│   │   └── ActionParser.tsx    # Renders interactive forms from JSON schema
│   ├── app.json                # Expo config
│   ├── eas.json                # EAS Build config (APK/AAB profiles)
│   └── package.json
│
├── .gitignore
├── Universal_App_Idea.md       # Original concept document
└── README.md                   # This file
```

---

## 🔒 Error Codes

| Status | Error | Meaning |
|--------|-------|---------|
| `401` | `API Key missing` | No `x-api-key` header provided |
| `403` | `Invalid API Key` | API key not found in database |
| `400` | `targetUserId and title are required` | Missing required fields |
| `404` | `User not found or has no active push token` | User ID doesn't exist or hasn't registered |
| `500` | `Failed to send notification` | Server error (check logs) |

---

## 🛠 Self-Hosting

To deploy your own instance:

1. **Clone the repo:**
   ```bash
   git clone https://github.com/Divu-bit/Universal-Bridge.git
   ```

2. **Set up the bridge server:**
   ```bash
   cd bridge-server
   npm install
   ```

3. **Create `.env`:**
   ```env
   PORT=3000
   MONGODB_URI=your_mongodb_connection_string
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
   ```

4. **Run:**
   ```bash
   npm start        # Production
   npm run dev      # Development (with hot-reload)
   ```

5. **Deploy to Render/Railway/Fly.io** and set the environment variables in their dashboard.

6. **Build the mobile app:**
   - Update `BRIDGE_SERVER_URL` in `mobile-app/app/(tabs)/index.tsx`
   - Run `npx eas build --platform android --profile preview` for APK

---

## 📄 License

MIT — Use it however you want.
