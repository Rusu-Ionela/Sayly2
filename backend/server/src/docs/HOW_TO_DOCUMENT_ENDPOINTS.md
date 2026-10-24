# How to Add and Document a New API Endpoint

Follow this pattern so validation, TypeScript types, and OpenAPI stay aligned.

## 1. Validation schema

Create or extend a Zod schema in the feature folder (`features/<feature>/schema.ts`).

Call `.openapi("SchemaName")` (and field examples) so the same schema feeds Swagger.

## 2. Types

Infer types with `z.infer<typeof schema>` or add DTOs under `features/<feature>/types.ts`.

Never expose `passwordHash`, refresh tokens, or internal security metadata in response DTOs.

## 3. Repository + service

- Repository: Drizzle access only (`features/<feature>/repository.ts`).
- Service: business rules; throw `AppError` with a stable `code`.
- Do not import Express `Request`/`Response` in services.

## 4. Controller + routes

- Parse with Zod at the controller boundary.
- Mount the router in `src/lib/app.ts`.
- Apply `authenticate` (and future role checks) on protected routes.
- Reuse `authRateLimiter` (or a sibling limiter) for sensitive endpoints.

## 5. OpenAPI documentation

1. Reuse or add schemas under `src/docs/schemas/`.
2. Add path definitions in `src/docs/paths/<feature>.paths.ts` via `registry.registerPath(...)`.
3. Call your `registerXPaths(registry)` from `src/docs/openapi.ts`.
4. Reuse `commonErrorResponses` and `bearerAuth` from `src/docs/components/responses.ts`.

Document for every endpoint:

1. HTTP method
2. Route path
3. Tag
4. Summary
5. Description
6. Request parameters / body
7. Validation rules (via Zod schema)
8. Authentication requirements
9. Success response
10. Error responses
11. Example values on schemas where helpful

## 6. Tests

Add Vitest coverage for happy path, validation failures, auth failures, and (when relevant) OpenAPI presence of the new path.

## Checklist

```text
- [ ] Zod schema (+ OpenAPI metadata)
- [ ] Service + repository
- [ ] Controller + route registration
- [ ] Auth / rate limit where needed
- [ ] OpenAPI path + reusable components
- [ ] Tests
```
