# ADR-0011: Ticket attachments live in Blob Storage

- **Status:** Accepted (20 Nov 2026) by the owner for the hosted edition.
- **Date proposed:** 2026-11-20
- **Decision owner:** product owner

## Context
Tickets can carry files and pictures. Today they are stored inside the ticket as base64, which makes tickets large and slow and cannot be sent through the API's 16 KB request limit. With everything on the server (ADR-0005, ADR-0010) the files need a home that is cheap, large and does not load the database.

## Decision
- **Files go in Azure Blob Storage** in a private container, in a folder per organisation. **PostgreSQL keeps one row per attachment** (organisation, ticket, name, size, type, who added it, when, and the path of the file). A ticket holds references, never file bytes.
- **Nothing is public.** Upload and download use short-lived links (SAS) that the API hands out only after it checks the caller's access to the ticket. The browser sends and fetches the file directly, so the API and the database carry no file traffic. The API records the row once the upload is confirmed.
- **Limits on the server:** a maximum size and an allowed list of file types. A file a browser could run as a page (HTML, SVG) is always downloaded, never shown inline. Virus scanning is a later step.
- **Deleting** an attachment or a ticket removes the row and the file, and writes an audit row.
- **Local edition:** files are separate files under `data/`, not inside the ticket JSON.
- **Infrastructure:** `infra/azure-playground/Setup-Playground.ps1 -Step infra` creates a Standard LRS storage account with public access off and a private `attachments` container, keeps its key in Key Vault, and sets the allowed browser origins (CORS). The real subscription uses a managed identity instead of a key.

## Consequences
- The web container's content policy (`connect-src 'self'`, `img-src`) must be widened to the storage address when the feature is built; the test in `server/webContainer.test.ts` will be updated with it.
- One more service to run, monitor and back up. Storage cost is far below database storage.
- Built on 20 Nov 2026: the attachment endpoints in `api/` (request, confirm, list, download, delete, and removal with a ticket or space), the `@azure/storage-blob` library (Microsoft, MIT, pinned) to sign the short-lived links, and the deploy step passing the storage account and key to the API. Files: pictures, PDF, plain data, zip and Office files, up to 25 MB, 50 per ticket; HTML and SVG are refused.
- Built later the same day: the ticket's Attachments panel in the hosted app, and the web container's content policy for the storage address (`STORAGE_ORIGIN`).
- Not yet built: file links (Drive, OneDrive, Dropbox) in the hosted edition, files in the create-ticket window, moving existing base64 attachments out of tickets (ADR-0008 migration), a job that removes uploads that were never confirmed, and virus scanning.
