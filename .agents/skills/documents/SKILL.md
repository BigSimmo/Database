---
name: documents
description: Verify Database document access, storage, signed images, metadata, extraction, labels, downloads, and lifecycle behavior. Use for private documents, image loading, signed URLs, document routes, or storage defects.
---

# Documents

1. Trace document identity, owner scope, metadata, storage key, route authorization, and rendered state.
2. Check private access, signed URL expiry, missing objects, image/page selection, downloads, deletion, and stale metadata.
3. Reproduce with local fixtures and focused route or component tests.
4. Verify no service-role secret or private object path reaches the client.
5. Treat live Supabase storage, production documents, and signed-URL calls as approval-required.
6. Report access proof, storage assumptions, failure behavior, and remaining live verification.
