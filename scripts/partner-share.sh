#!/usr/bin/env bash
set -euo pipefail

# Generate a partner-shareable Helm bundle from local chart files.
# Output folder will only keep:
#   partner-share/pos-validation-sdk-partner/
# Partner can run one script from inside that folder: ./partner-deploy-gcp.sh
#
# Usage:
#   ./scripts/partner-share.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART_SRC_DIR="${ROOT_DIR}/helm/pos-validation-sdk"
DEPLOY_SCRIPT_SRC="${ROOT_DIR}/scripts/partner-deploy-gcp.sh"
DESTROY_SCRIPT_SRC="${ROOT_DIR}/scripts/partner-destroy-gcp.sh"
CHECK_SCRIPT_SRC="${ROOT_DIR}/scripts/partner-check-gcp-deployment.sh"
PARTNER_README_SRC="${ROOT_DIR}/scripts/partner-share-README.md"
PARTNER_README_HTML_SRC="${ROOT_DIR}/scripts/partner-share-README.html"
OUT_BASE_DIR="${ROOT_DIR}/partner-share"
BUNDLE_DIR="${OUT_BASE_DIR}/pos-validation-sdk-partner"
TAG_STATE_FILE="${OUT_BASE_DIR}/.last-image-tag"

IMAGE_REPO="docker.io/thecouponbureau/pos-validation-sdk"
IMAGE_TAG="${IMAGE_TAG:-}"
DOMAIN="<YOUR_DOMAIN>"
STATIC_IP_NAME="coupon-api-ip"
NAMESPACE="${NAMESPACE:-coupon-app}"
RELEASE_NAME="${RELEASE_NAME:-coupon-api}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image-tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    --release-name)
      RELEASE_NAME="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

resolve_default_image_tag() {
  if [[ -n "${IMAGE_TAG}" ]]; then
    return
  fi
  if [[ -f "${TAG_STATE_FILE}" ]]; then
    IMAGE_TAG="$(cat "${TAG_STATE_FILE}")"
    return
  fi
  IMAGE_TAG="v9"
}

if [[ ! -d "${CHART_SRC_DIR}" ]]; then
  echo "Chart source not found: ${CHART_SRC_DIR}"
  exit 1
fi
if [[ ! -f "${DEPLOY_SCRIPT_SRC}" ]]; then
  echo "Partner deploy script not found: ${DEPLOY_SCRIPT_SRC}"
  exit 1
fi
if [[ ! -f "${DESTROY_SCRIPT_SRC}" ]]; then
  echo "Destroy script not found: ${DESTROY_SCRIPT_SRC}"
  exit 1
fi
if [[ ! -f "${CHECK_SCRIPT_SRC}" ]]; then
  echo "Check script not found: ${CHECK_SCRIPT_SRC}"
  exit 1
fi
if [[ ! -f "${PARTNER_README_SRC}" ]]; then
  echo "Partner README source not found: ${PARTNER_README_SRC}"
  exit 1
fi
if [[ ! -f "${PARTNER_README_HTML_SRC}" ]]; then
  echo "Partner README HTML source not found: ${PARTNER_README_HTML_SRC}"
  exit 1
fi

mkdir -p "${OUT_BASE_DIR}"
mkdir -p "${BUNDLE_DIR}"
resolve_default_image_tag

# Keep partner-share folder clean: only one partner bundle folder.
find "${OUT_BASE_DIR}" -mindepth 1 -maxdepth 1 ! -name ".last-image-tag" -exec rm -rf {} +
mkdir -p "${BUNDLE_DIR}"

echo "[INFO] Copying chart..."
cp -R "${CHART_SRC_DIR}" "${BUNDLE_DIR}/pos-validation-sdk"
cp "${DEPLOY_SCRIPT_SRC}" "${BUNDLE_DIR}/partner-deploy-gcp.sh"
cp "${DESTROY_SCRIPT_SRC}" "${BUNDLE_DIR}/partner-destroy-gcp.sh"
cp "${CHECK_SCRIPT_SRC}" "${BUNDLE_DIR}/partner-check-gcp-deployment.sh"
cp "${PARTNER_README_SRC}" "${BUNDLE_DIR}/README.md"
cp "${PARTNER_README_HTML_SRC}" "${BUNDLE_DIR}/README.html"
chmod +x "${BUNDLE_DIR}/partner-deploy-gcp.sh"
chmod +x "${BUNDLE_DIR}/partner-destroy-gcp.sh"
chmod +x "${BUNDLE_DIR}/partner-check-gcp-deployment.sh"

# Also place helper scripts at top-level partner-share for quick access.
cp "${DEPLOY_SCRIPT_SRC}" "${OUT_BASE_DIR}/partner-deploy-gcp.sh"
cp "${DESTROY_SCRIPT_SRC}" "${OUT_BASE_DIR}/partner-destroy-gcp.sh"
cp "${CHECK_SCRIPT_SRC}" "${OUT_BASE_DIR}/partner-check-gcp-deployment.sh"
cp "${PARTNER_README_SRC}" "${OUT_BASE_DIR}/README.md"
cp "${PARTNER_README_HTML_SRC}" "${OUT_BASE_DIR}/README.html"
chmod +x "${OUT_BASE_DIR}/partner-deploy-gcp.sh"
chmod +x "${OUT_BASE_DIR}/partner-destroy-gcp.sh"
chmod +x "${OUT_BASE_DIR}/partner-check-gcp-deployment.sh"

echo "${IMAGE_TAG}" > "${TAG_STATE_FILE}"

cat > "${BUNDLE_DIR}/bundle-config.env" <<EOF
IMAGE_REPO=${IMAGE_REPO}
IMAGE_TAG=${IMAGE_TAG}
NAMESPACE=${NAMESPACE}
RELEASE_NAME=${RELEASE_NAME}
STATIC_IP_NAME=${STATIC_IP_NAME}
EOF

cat > "${BUNDLE_DIR}/partner-values.yaml" <<EOF
image:
  repository: ${IMAGE_REPO}
  tag: ${IMAGE_TAG}
EOF

cat > "${BUNDLE_DIR}/ingress-https.yaml" <<EOF
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: coupon-api-cert
  namespace: ${NAMESPACE}
spec:
  domains:
    - ${DOMAIN}
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: coupon-api-ingress
  namespace: ${NAMESPACE}
  annotations:
    kubernetes.io/ingress.class: "gce"
    kubernetes.io/ingress.global-static-ip-name: "${STATIC_IP_NAME}"
    networking.gke.io/managed-certificates: "coupon-api-cert"
spec:
  rules:
    - host: ${DOMAIN}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${RELEASE_NAME}-pos-validation-sdk
                port:
                  number: 3000
EOF

# Optionally package chart if helm exists.
if command -v helm >/dev/null 2>&1; then
  echo "[INFO] Packaging chart with helm..."
  helm package "${BUNDLE_DIR}/pos-validation-sdk" --destination "${BUNDLE_DIR}" >/dev/null
else
  echo "[WARN] Helm not found. Skipping helm package step."
fi

echo "[INFO] Bundle folder: ${BUNDLE_DIR}"
echo "[INFO] Done. Share the folder '${BUNDLE_DIR}' (or zip it manually)."
