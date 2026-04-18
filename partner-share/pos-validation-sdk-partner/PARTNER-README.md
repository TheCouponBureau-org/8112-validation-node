# Partner Install Guide (GKE + Helm)

## Recommended (Interactive)

1. Extract the zip.
2. Open terminal in extracted folder.
3. Run:
```bash
./partner-deploy-gcp.sh
```

This script asks for dynamic values (project ID, cluster, zone, domain, static IP, DNS zone) and deploys step-by-step.
Image tag is managed internally from `bundle-config.env` / `.last-image-tag`.

## Manual Files Included
- `pos-validation-sdk/` (Helm chart)
- `pos-validation-sdk-0.1.0.tgz` (packaged chart)
- `bundle-config.env` (internal defaults including image tag)
- `partner-values.yaml` (image repo/tag overrides)
- `ingress-https.yaml` (HTTPS + managed cert template)
- `partner-deploy-gcp.sh` (interactive deploy script)
- `partner-check-gcp-deployment.sh` (post-deploy validation script)
- `partner-destroy-gcp.sh` (interactive cleanup script)
