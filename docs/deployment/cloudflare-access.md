# Cloudflare Pages and Access handoff

This dashboard contains private research data. Cloudflare Access is the security
boundary for **both HTML and static JSON**. The React application intentionally
has no password prompt and must not be treated as an authentication layer.

## Deployment-time inputs

Supply these values while configuring the deployment. They are placeholders,
not values to commit to this repository.

| Input | GitHub location | Notes |
| --- | --- | --- |
| `WANDB_API_KEY` | Actions secret | Read-only access to the selected W&B project. |
| `CLOUDFLARE_API_TOKEN` | Actions secret | Scope to the target account with Cloudflare Pages edit permission only. |
| `CLOUDFLARE_ACCOUNT_ID` | Actions secret | Account containing the Direct Upload Pages project. |
| `WANDB_ENTITY` | Actions variable | Exact source entity/team; never infer it by enumerating the account. |
| `WANDB_PROJECT` | Actions variable | Exact source project; the export config narrows runs further. |
| `CLOUDFLARE_PAGES_PROJECT` | Actions variable | Existing Direct Upload project whose production branch is `main`. |
| Reviewer email allowlist | Cloudflare Access input | Individual email addresses supplied by the deployment owner. Do not commit them. |
| Negative-test email | Acceptance-test input | Owner-controlled address that is deliberately absent from the allowlist. |
| Production/custom hostnames | Cloudflare Access input | Record at deployment time; do not place private hostnames in fixtures or screenshots. |

Configure the three secrets at **GitHub repository > Settings > Secrets and
variables > Actions > Secrets**, and configure the three non-secret identifiers
under **Variables**. The production workflow stops before export or upload if a
required input is empty.

Create the Pages project as **Direct Upload** and set its production branch to
`main`. The workflow builds locally and performs `wrangler pages deploy dist` as
its final step. Export, Pydantic validation, frontend validation/build, or scan
failure therefore cannot replace the last successful production deployment.
Concurrent production runs are serialized and are not cancelled midway.

References: [Direct Upload with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/),
[Wrangler Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/), and
[Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/).

## Default-deny Access setup

Perform these steps with an account administrator. Cloudflare has separate
coverage for the production `pages.dev` hostname and preview deployment
hostnames; both are required.

1. In **Zero Trust > Integrations > Identity providers**, add **One-time PIN** if
   it is not already available. Do not select a broad login method as the only
   Allow rule.
2. In **Workers & Pages > the target project > Settings > General**, select
   **Enable access policy**. This creates protection for preview deployments.
3. Follow Cloudflare's current `pages.dev` workaround exactly:

   - Select **Manage** on the generated preview Access application.
   - In **Zero Trust > Access controls > Applications**, configure that app.
   - Under **Public hostname**, remove the `*` from the Subdomain field and save.
     Rename the application if Cloudflare reports a duplicate name.
   - Return to the Pages project's **Settings > General** and select
     **Enable access policy** again.
   - Confirm there are now two applications: one for
     `<PAGES_PROJECT>.pages.dev` and one for
     `*.<PAGES_PROJECT>.pages.dev`.

4. Create one reusable policy, or equivalent identical policies on both apps:

   - Action: **Allow**.
   - Include: **Emails**, listing only the deployment-time reviewer addresses.
   - Require: **Login Methods > One-time PIN**.
   - Session duration: **1 hour or shorter**.

5. Attach the policy to both applications. Remove any generated Allow rule for
   all account members unless every member is an intended reviewer. Do not add
   `Everyone`, an email-domain wildcard, `Bypass`, or a public path exception.
   Access is deny-by-default, so a request that matches no Allow policy stays
   denied.
6. If a custom production domain is used, create a third **Self-hosted and
   private** application for that exact hostname and attach the same policy.
   Leave the Path field empty so every path is covered.
7. In each application, use **Policies > Policy tester > testing a single user**
   for one supplied allowlisted address and the supplied negative-test address.
   Record only `allowed`/`denied`; do not record either address.

Cloudflare documents the two-application Pages procedure under
[Enable Access on your `pages.dev` domain](https://developers.cloudflare.com/pages/platform/known-issues/#enable-access-on-your-pagesdev-domain),
the OTP flow under [One-time PIN login](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/),
and the policy semantics under [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/).

## Acceptance checklist

Use a production URL and a hash-specific preview URL. Perform the denied checks
from a new private browser session with no `CF_Authorization` cookie. Obtain the
hashed dataset path only after authenticating: open `/data/manifest.json` and
copy one manifest-listed chunk path into the local shell variable below.

If an approved Cloudflare plugin/connector is available, it may perform the
read-only configuration checks before the browser checks. Authenticate that
plugin only at deployment time; do not save its credentials or output in the
repository. Its acceptance output must confirm, with values redacted:

- [ ] The named Pages project is Direct Upload and its production branch is
  `main`.
- [ ] Separate Access applications cover the exact production hostname and the
  one-level wildcard preview hostname, with no path exclusions.
- [ ] Both applications attach the same individual-email Allow policy, require
  One-time PIN, and use a session duration of 1 hour or shorter.
- [ ] Neither application has an `Everyone`, `Bypass`, broad email-domain, or
  unreviewed service-token rule.

Plugin inspection cannot prove request enforcement or OTP delivery. The private
browser and authenticated Network-panel checks below remain mandatory.

```bash
AIRFOIL_PRODUCTION_ORIGIN='https://<PAGES_PROJECT>.pages.dev'
AIRFOIL_PREVIEW_ORIGIN='https://<DEPLOYMENT_HASH>.<PAGES_PROJECT>.pages.dev'
AIRFOIL_HASHED_JSON_PATH='/data/<HASHED_CHUNK>.json'

curl --silent --show-error --max-redirs 0 --dump-header - --output /dev/null \
  "$AIRFOIL_PRODUCTION_ORIGIN/"
curl --silent --show-error --max-redirs 0 --dump-header - --output /dev/null \
  "$AIRFOIL_PRODUCTION_ORIGIN$AIRFOIL_HASHED_JSON_PATH"
curl --silent --show-error --max-redirs 0 --dump-header - --output /dev/null \
  "$AIRFOIL_PREVIEW_ORIGIN/"
curl --silent --show-error --max-redirs 0 --dump-header - --output /dev/null \
  "$AIRFOIL_PREVIEW_ORIGIN$AIRFOIL_HASHED_JSON_PATH"
```

For each unauthenticated request, accept an Access login redirect or Access
`401`/`403`; **a `200` is a failure**. Do not use `--location`, because following
the redirect only proves that the login page is public. Confirm that neither the
dashboard HTML nor JSON body was returned.

Then complete all items below and copy the outcomes into a dated file based on
`docs/qa/acceptance-template.md`.

- [ ] The supplied negative-test address is denied by the policy tester and does
  not receive an OTP email.
- [ ] The supplied allowlisted address can request a single-use OTP and open the
  production dashboard.
- [ ] The same allowlisted session receives `200` for `/` and a manifest-listed
  hashed JSON chunk in the browser Network panel.
- [ ] A fresh allowlisted OTP session can open the hash-specific preview URL and
  its hashed JSON chunk.
- [ ] A fresh unauthenticated session is denied for production HTML, production
  JSON, preview HTML, and preview JSON.
- [ ] Authenticated response headers include the repository CSP with
  `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, and `X-Robots-Tag: noindex`.
- [ ] `/robots.txt` returns `200` after authentication and contains
  `User-agent: *` plus `Disallow: /`.
- [ ] No application policy contains `Everyone`, `Bypass`, a domain-wide email
  rule, or an unreviewed service token.
- [ ] Browser storage and the application UI contain no client-side password,
  reviewer list, W&B key, or Cloudflare credential.

Never paste an OTP, Access cookie, API token, account ID, reviewer address, or
response body into an issue, test trace, screenshot, or QA evidence file. A
completed evidence row should contain timestamp, tester role, target category
(production/preview), status code category, pass/fail, and a redacted screenshot
or header-name-only note.

## Last-good-deployment failure drill

Run this only against a disposable Pages project/preview target with synthetic
fixtures; never corrupt the live snapshot to create a test.

1. Record the current verified production deployment ID and confirm it serves
   the fixture dashboard after Access authentication.
2. On a temporary test branch, force one pre-upload stage to exit non-zero
   (export, validation, build, or scanner). Confirm the Wrangler step is skipped
   and the recorded deployment remains live.
3. Against the disposable project, run Wrangler with an intentionally invalid
   project name or insufficient test token. Confirm upload fails and the recorded
   deployment remains live.
4. Remove the deliberate failure, rerun normally, and record only deployment
   IDs/statuses. Never record token values or authenticated response bodies.

Do not mark this drill passed until it has been executed with deployment-time
credentials. Repository-only review can mark it only `blocked` with the required
handoff.
