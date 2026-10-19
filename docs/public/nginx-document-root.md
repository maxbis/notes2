# Nginx Document Root

## Purpose

Deploy Notes where nginx serves the project's `public/` directory.

## Location

- Document root: `/Users/maxbisschop/dev/www/notes2/public` in this checkout; use the equivalent path on the server.
- Web entrypoints: `public/index.php`, `public/app.php`, `public/api.php`, `public/login/index.php`, and `public/public/index.php`.
- PHP implementations and configuration: project root and `api/` and `login/` directories outside the document root.

## Inputs/Outputs

- Browser URLs: `/`, `/app.php`, `/api.php`, `/login/`, and `/public/?id=...`.
- Static URLs: `/app.js`, `/js/`, `/style.css`, `/warm-paper/`, `/vendor/`, `/icons/`, `/manifest.webmanifest`, and `/login/login.css`.
- Private files such as `config.php` and `login/validkeys.txt` are not reachable as static files from the document root.

## Flow/Behavior

1. Point nginx's `root` at the project `public/` directory and set `index index.php`.
2. Pass the PHP entrypoints to PHP-FPM, with `SCRIPT_FILENAME` resolving to the PHP file inside that document root.
3. Allow PHP to read the parent project directory, because each web entrypoint includes its implementation there.
4. Preserve query strings for the API and public note URL. Directory requests to `/login/` and `/public/` should run their nested `index.php` files.
5. Keep the app and all files together in the same deployed checkout. Do not publish only the `public/` directory.

## Edge Cases/Failure Modes

- When PHP is disabled for nested directories, `/login/` and `/public/` will not run their entrypoints.
- When PHP-FPM is restricted to the document root by `open_basedir` or filesystem permissions, the entrypoints cannot include the application code or configuration.
- When nginx serves a different root, the relative asset and API URLs will fail.
- When the app is mounted under a URL prefix rather than the site root, review the relative URLs and manifest scope against that prefix.

## Related Files

- `public/index.php`
- `public/app.php`
- `public/api.php`
- `public/login/index.php`
- `public/public/index.php`
- `app.php`
- `api.php`
- `public.php`
