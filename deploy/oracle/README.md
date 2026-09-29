# Oracle deployment preparation

Status: templates prepared locally; no Oracle account or server has been accessed,
no resources have been created, and these templates have not been validated on Linux.

## Account and instance

1. Sign up at https://www.oracle.com/cloud/free/ using an email the owner can retain.
   Complete identity/card verification directly with Oracle and enable MFA.
2. Choose the home region carefully: Always Free compute/storage must be in that
   region and the home region cannot be changed. Availability is not guaranteed.
3. In Compute > Instances > Create instance, name it `nvo-web` and select an
   Always Free-eligible Ubuntu image compatible with ARM (Ubuntu 24.04 LTS preferred).
4. Select `VM.Standard.A1.Flex`, 2 OCPUs, 6 GB RAM, and a 50 GB boot volume.
   Check the Always Free eligibility in the console, including any other resources
   already in the account. Do not substitute a paid shape just to bypass capacity errors.
5. Use a public subnet with an internet gateway and assign a public IPv4 address.
   Save the SSH private key securely on the local computer; do not paste it into chat.
6. Allow TCP 22 only from the administrator's current public IP (/32), and TCP 80/443
   for website visitors. Both OCI network rules and the guest OS firewall must permit
   these connections. Keep application port 3000 private. Preserve SSH access while
   configuring firewall rules; do not flush Oracle's existing firewall rules blindly.

Share the chosen region, server public IP, and the local private-key file path with
the deployment operator. Account passwords, card details and private-key contents
are not needed in chat. Initial SSH host fingerprints must be verified.

## Server layout and installation plan

- Install Node 24 for the server's actual architecture, and Caddy from official sources.
- Create a dedicated `nvo` service user; put application code in `/srv/nvo`.
- Transfer source, package lock, and `public/`. Exclude Windows `node_modules`, `.next`,
  test databases, private credentials, original source-media folders, and artifacts.
- Preserve the actual restaurant data: use SQLite's online backup API for a consistent
  database export, and copy `data/uploads`. Coordinate the final transfer while admin
  edits are paused. Do not copy only a live WAL-mode database file and lose its WAL data.
- Install dependencies on Linux with `npm ci`. Do not reuse Windows native binaries.
- Copy/download the translation models into `data/models`, and verify both translation
  directions on ARM. `npm run setup:translation` installs/checks them.
- Build with `SOCIAL_WORKER_MODE=off npm run build` to avoid publishing during preparation.
- Create `/srv/nvo/data` and `/srv/nvo/.next/cache`, writable by the `nvo` user; the rest
  of the installed code should be readable but not writable by the runtime user.
- Complete `production.env.example` privately and install it as `/etc/nvo/nvo.env`
  with root ownership and mode 0600. Preserve existing encryption keys. Keep environment
  configuration in this single location instead of copying a conflicting `.env.local`.
- Verify `command -v node`, adjust `ExecStart` if needed, and install `nvo.service` into
  `/etc/systemd/system/`. Validate with `systemd-analyze verify` before enabling it.
- Use a hostname controlled by the owner/operator (a temporary subdomain is fine).
  Point its DNS to the public IP, replace the Caddyfile hostname and SITE_URL together,
  validate with `caddy validate`, and install the Caddy configuration. Caddy handles HTTPS.
- Enable the application and Caddy services at boot. Inspect their logs and verify HTTPS,
  homepage, both menu languages, admin login, upload persistence, translation, coupon
  client-IP verification, and the publishing-worker heartbeat. Run destructive browser
  suites only against an isolated test database.

The reverse proxy intentionally overwrites `X-Real-IP`; the application trusts only
its local Caddy connection. Adding a CDN later requires revisiting trusted-proxy
configuration so coupon users are not all identified as the CDN's IP.

## Backups and activation

Before relying on the site, schedule consistent SQLite backups and copies of uploads
to a separate destination, secure a backup of encryption keys, and test restoration.
Server-local copies alone do not protect against losing the server/account. Configure
uptime monitoring and check disk space. These jobs are not installed by the templates.

Keep sample content clearly identified during review. Social accounts can be configured
later; live publishing needs actual provider authorization and an approved test post.
There are currently no connected accounts in the local restaurant database.

Oracle may reclaim idle Always Free instances. This deployment does not guarantee uptime.
Stay within Always Free limits rather than depending on temporary trial credits.

## References

- https://www.oracle.com/cloud/free/faq/
- https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm
- https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/managingregions.htm
- https://caddyserver.com/docs/caddyfile/directives/reverse_proxy

Checked 2026-09-27; recheck console eligibility and current limits before provisioning.
