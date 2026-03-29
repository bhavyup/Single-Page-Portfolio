# Security Policy

## Supported Versions

This project tracks the `main` branch for security fixes.

## Reporting a Vulnerability

Please do not open public issues for sensitive reports.

1. Email the maintainer with steps to reproduce.
2. Include affected route/module and potential impact.
3. Allow a reasonable private disclosure window before publication.

## Security Controls in Place

- HTTP hardening headers via Helmet + CSP
- HttpOnly session cookies for admin auth
- CSRF double-submit protection for state-changing admin APIs
- Login and admin API rate limiting
- Schema validation for content payloads
- Audit log trail for admin actions
