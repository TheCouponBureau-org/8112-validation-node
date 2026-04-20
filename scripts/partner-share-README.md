# Partner Deployment Guide (GKE + Helm)

This folder contains scripts and chart files to deploy, validate, and destroy the POS Validation SDK on Google Kubernetes Engine.

## Prerequisites

Install these commands before running scripts:
- `gcloud`
- `kubectl`
- `helm`
- `curl`
- `dig` (or `nslookup`)

Google Cloud authentication is required.

For testing, you can use a new Google Cloud trial account/project. Google Cloud commonly offers up to **$300 in free trial credits** for eligible new users.

## Deployment Sequence

Run from this folder:

```bash
./partner-deploy-gcp.sh
```

What this script does:
1. Checks prerequisites and active `gcloud` auth.
2. Reuses saved config defaults (press Enter to accept).
3. Deploys Helm release.
4. Shows static IP for DNS A record setup.
5. Waits for your DNS confirmation.
6. Applies ingress + managed certificate.
7. Saves local state/config files for next runs:
   - `deployment-config.env`
   - `deployment-state.env`

## Check / Validation

After deploy, run:

```bash
./partner-check-gcp-deployment.sh
```

It validates:
- cluster connectivity
- deployment readiness
- ingress/certificate status
- DNS A record mapping
- HTTPS `/healthz`

## Destroy / Cleanup

To remove everything (Helm release, namespace resources, cluster, static IP, optional DNS):

```bash
./partner-destroy-gcp.sh
```

The destroy script auto-loads saved values from:
- `deployment-state.env` (preferred)
- `deployment-config.env` (fallback)

No need to re-enter values if these files exist.
