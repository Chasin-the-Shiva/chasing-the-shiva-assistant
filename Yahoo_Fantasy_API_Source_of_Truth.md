# ShivaGPT — Yahoo Fantasy API Source of Truth

Last updated: September 14, 2026

Status: **WAITING FOR YAHOO PROVISIONING CONFIRMATION**

## Resume rule

When the user says **"continue ShivaGPT"**, **"finish ShivaGPT"**, or **"complete setting up ShivaGPT"**, resume from the exact checkpoint in this file.

Do not recreate or repeat completed work. Do not use Red Moose systems, websites, hosting, email, or business infrastructure.

## Goal

Provide persistent, read-only access to Yahoo Fantasy league **Chasing the Shiva** and team **Chase’n The Shiva** for roster, settings, waiver, transaction, matchup, standings, and lineup analysis.

Yahoo league ID: **721343**

The user remains the only person who performs Yahoo adds, drops, claims, trades, draft selections, and lineup changes.

## Existing personal GitHub project — complete

- Repository: **Chasin-the-Shiva/chasing-the-shiva-assistant**
- Repository URL: https://github.com/Chasin-the-Shiva/chasing-the-shiva-assistant
- GitHub Pages URL: https://chasin-the-shiva.github.io/chasing-the-shiva-assistant/
- GitHub Pages is enabled.
- The repository originally contained only README.md before this checkpoint.
- No OAuth implementation, runtime, dependency file, deployment workflow, or committed secrets existed at the September 14 audit.
- Do not create another repository or website.

## Yahoo approval and agreement — complete

- Yahoo approved the Personal Use Fantasy Sports API request.
- The Yahoo API Access and Use Agreement was signed and completed through DocuSign.
- Do not repeat these steps.

## Yahoo Developer application — complete

- Application name: **Chasing the Shiva Assistant**
- Homepage URL: https://github.com/Chasin-the-Shiva/chasing-the-shiva-assistant
- Redirect URI: https://chasin-the-shiva.github.io/chasing-the-shiva-assistant/
- OAuth client type: **Confidential Client**
- Permission: **Fantasy Sports - Read** only
- OpenID Connect and TW Auction were not selected.
- Yahoo generated the App ID, Client ID, and Client Secret.
- Credential values are intentionally not stored in GitHub.
- Do not create another Yahoo Developer application.

## Yahoo confirmation form — complete

On September 14, 2026, the Yahoo **Developer Application Confirmation Form** was submitted with the approved applicant information and newly generated Client ID.

Yahoo confirmed: **"Your Client ID has been submitted. We'll be in touch shortly."**

Do not resubmit unless Yahoo specifically requests it.

## Current blocker and exact resume point

Yahoo provisioning confirmation is pending.

Next:

1. Wait for the Yahoo Fantasy API team provisioning/confirmation email.
2. Verify that API access is provisioned.
3. Do not recreate GitHub Pages, the repository, the Yahoo app, the DocuSign agreement, or the confirmation form.
4. Continue with OAuth authorization using the existing app.
5. Enter credentials only into encrypted secret/environment-variable fields:
   - `YAHOO_CLIENT_ID`
   - `YAHOO_CLIENT_SECRET`
   - `YAHOO_REFRESH_TOKEN` (created during OAuth)
6. Never request credential values in chat.
7. Implement and test token refresh.
8. Test read-only API access in this order:
   - authenticated Yahoo user;
   - NFL game/season;
   - league 721343 metadata and settings;
   - teams and managers;
   - Chase’n The Shiva roster and lineup;
   - transactions, waivers/free agents, matchups, and standings.
9. API data becomes the primary live Yahoo source only after current roster/settings retrieval and token refresh both succeed.

## Security

- Personal-project infrastructure only.
- No Red Moose systems or business infrastructure.
- Never commit or display secrets, tokens, passwords, authorization codes, or recovery codes.
- Yahoo permission remains read-only.
