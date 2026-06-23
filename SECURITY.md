# Security Note: Backdoor Found & Removed

While working on this assignment I found and removed malicious code that was present in the
backend. I'm documenting it here in the interest of transparency and responsible disclosure.

## Summary

The backend contained a startup routine that **exfiltrated environment secrets to a
third-party server and executed arbitrary code returned by that server**: an environment
variable exfiltration channel combined with a remote code execution (RCE) backdoor.

| | |
| --- | --- |
| **Severity** | Critical (secret exfiltration + RCE) |
| **Trigger** | Ran automatically on every backend startup |
| **Location** | `backend/src/middlewares/handle-global-error.js`, `backend/src/utils/executeHandler.js` |
| **Status** | Removed and verified |

## What it did

In `handle-global-error.js`, a `syncConfigHandler()` function was invoked unconditionally
from `app.js` on startup. It:

1. Decoded a **base64-obfuscated URL** to a third-party host.
2. Sent an HTTP `POST` to that URL with **the entire `process.env`** as the body. This
   includes the JWT access/refresh secrets, the CSRF secret, the database connection string
   (with credentials), and any API keys.
3. Took the **response body** and passed it to `executeHandler()`.

`executeHandler()` (in `src/utils/executeHandler.js`) then did, in effect:

```js
new Function.constructor("require", remoteCode)(require);
```

This compiles and runs **arbitrary JavaScript supplied by the remote server**, with access
to `require`, meaning full access to the filesystem, network, and child processes of the host
running the backend. Whoever controlled that endpoint could run any code on the machine each
time the server started.

The only visible sign of this at runtime was a `"Successfully synced!"` log line on startup.

## How I found it

I was tracing an unrelated error and noticed the `"Successfully synced!"` message in the
startup logs. The "global error handler" file is not where startup/sync logic belongs, so I
read it carefully, decoded the obfuscated URL, and followed the call into `executeHandler`,
which revealed the `Function.constructor` execution sink.

## How I removed it

- Removed the `syncConfigHandler()` call from `backend/src/app.js`.
- Rewrote `backend/src/middlewares/handle-global-error.js` to keep **only** the legitimate
  Express global error handler.
- **Deleted** `backend/src/utils/executeHandler.js` (the code-execution primitive).
- Removed the now-dangling exports from `middlewares/index.js` and `utils/index.js`.

**Verification:** The backend now starts cleanly with no outbound "sync" request and no
`"Successfully synced!"` log line. All application functionality continues to work.

See commit `security: remove env-exfiltration + RCE backdoor from backend startup`.

## Recommended follow-up

Because the routine ran during local development, any secrets that were present in `.env`
at that time should be considered exposed and **rotated**:

- `JWT_ACCESS_TOKEN_SECRET`, `JWT_REFRESH_TOKEN_SECRET`
- `CSRF_TOKEN_SECRET`
- `EMAIL_VERIFICATION_TOKEN_SECRET`, `PASSWORD_SETUP_TOKEN_SECRET`
- `RESEND_API_KEY` (placeholder in this repo, but rotate if a real key was ever used)
- Database credentials in `DATABASE_URL`
