#!/usr/bin/env bash
set -euo pipefail

# Destroys a full GKE deployment stack:
# - Helm release + namespace resources (if reachable)
# - Ingress + ManagedCertificate
# - Optional Cloud DNS A record
# - GKE cluster
# - Global static IP
#
# Usage:
#   ./partner-destroy-gcp.sh
#   ./partner-destroy-gcp.sh --force
#   ./partner-destroy-gcp.sh --from-state ./deployment-state.env

FORCE="false"
STATE_FILE="${PWD}/deployment-state.env"
CONFIG_FILE="${PWD}/deployment-config.env"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE="true"
      shift
      ;;
    --from-state)
      STATE_FILE="${2:-}"
      shift 2
      ;;
    --from-config)
      CONFIG_FILE="${2:-}"
      shift 2
      ;;
    *)
      echo "[ERROR] Unknown argument: $1"
      exit 1
      ;;
  esac
done

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "[ERROR] Missing required command: ${cmd}"
    exit 1
  fi
}

ask() {
  local prompt="$1"
  local default_val="${2:-}"
  local answer=""
  if [[ -n "${default_val}" ]]; then
    read -r -p "${prompt} [${default_val}]: " answer
    echo "${answer:-${default_val}}"
  else
    read -r -p "${prompt}: " answer
    echo "${answer}"
  fi
}

confirm() {
  local prompt="$1"
  local answer=""
  read -r -p "${prompt} [y/N]: " answer
  [[ "${answer}" =~ ^[Yy]$ ]]
}

require_cmd gcloud
require_cmd kubectl
require_cmd helm

PROJECT_ID=""
CLUSTER_NAME=""
ZONE=""
NAMESPACE=""
RELEASE_NAME=""
STATIC_IP_NAME=""
DOMAIN=""
DNS_ZONE=""

if [[ -f "${STATE_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${STATE_FILE}"
  echo "[INFO] Loaded deployment state from: ${STATE_FILE}"
elif [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
  echo "[INFO] Loaded deployment config from: ${CONFIG_FILE}"
else
  PROJECT_ID="$(ask 'GCP Project ID' '')"
  CLUSTER_NAME="$(ask 'GKE Cluster Name' 'my-cluster')"
  ZONE="$(ask 'GKE Zone' 'us-central1-a')"
  NAMESPACE="$(ask 'Kubernetes Namespace' 'coupon-app')"
  RELEASE_NAME="$(ask 'Helm Release Name' 'coupon-api')"
  STATIC_IP_NAME="$(ask 'Global Static IP Name' 'coupon-api-ip')"
  DOMAIN="$(ask 'Domain to delete A record for (optional)' '')"
  DNS_ZONE="$(ask 'Cloud DNS managed zone (optional)' '')"
fi

CLUSTER_NAME="${CLUSTER_NAME:-my-cluster}"
ZONE="${ZONE:-us-central1-a}"
NAMESPACE="${NAMESPACE:-coupon-app}"
RELEASE_NAME="${RELEASE_NAME:-coupon-api}"
STATIC_IP_NAME="${STATIC_IP_NAME:-coupon-api-ip}"
DOMAIN="${DOMAIN:-}"
DNS_ZONE="${DNS_ZONE:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "[ERROR] Project ID is required."
  exit 1
fi

echo
echo "[PLAN] The script will delete:"
echo "  - Helm release: ${RELEASE_NAME} (if present)"
echo "  - Namespace resources in: ${NAMESPACE}"
echo "  - GKE cluster: ${CLUSTER_NAME} (${ZONE})"
echo "  - Global static IP: ${STATIC_IP_NAME}"
if [[ -n "${DOMAIN}" && -n "${DNS_ZONE}" ]]; then
  echo "  - DNS A record: ${DOMAIN}. in zone ${DNS_ZONE}"
fi
echo

if [[ "${FORCE}" != "true" && ! -f "${STATE_FILE}" && ! -f "${CONFIG_FILE}" ]]; then
  if ! confirm "Continue with destructive delete?"; then
    echo "[INFO] Aborted."
    exit 0
  fi
fi

echo "[INFO] Setting active project..."
gcloud config set project "${PROJECT_ID}" >/dev/null

cluster_exists="false"
if gcloud container clusters describe "${CLUSTER_NAME}" --zone "${ZONE}" >/dev/null 2>&1; then
  cluster_exists="true"
fi

if [[ "${cluster_exists}" == "true" ]]; then
  echo "[INFO] Fetching cluster credentials..."
  gcloud container clusters get-credentials "${CLUSTER_NAME}" --zone "${ZONE}" --project "${PROJECT_ID}" >/dev/null

  echo "[INFO] Deleting ingress/cert resources (best effort)..."
  kubectl delete ingress coupon-api-ingress -n "${NAMESPACE}" --ignore-not-found=true || true
  kubectl delete managedcertificate coupon-api-cert -n "${NAMESPACE}" --ignore-not-found=true || true

  echo "[INFO] Uninstalling Helm release (best effort)..."
  helm uninstall "${RELEASE_NAME}" -n "${NAMESPACE}" >/dev/null 2>&1 || true

  echo "[INFO] Deleting namespace (best effort)..."
  kubectl delete namespace "${NAMESPACE}" --ignore-not-found=true --wait=false || true
else
  echo "[WARN] Cluster not found, skipping Kubernetes resource cleanup."
fi

if [[ -n "${DOMAIN}" && -n "${DNS_ZONE}" ]]; then
  echo "[INFO] Attempting DNS A record cleanup for ${DOMAIN}. in zone ${DNS_ZONE}..."
  existing_ip="$(gcloud dns record-sets list \
    --zone="${DNS_ZONE}" \
    --name="${DOMAIN}." \
    --type=A \
    --format='value(rrdatas[0])' 2>/dev/null | head -n 1 || true)"
  if [[ -n "${existing_ip}" ]]; then
    txn_file="$(mktemp)"
    gcloud dns record-sets transaction start --zone="${DNS_ZONE}" --transaction-file="${txn_file}"
    gcloud dns record-sets transaction remove "${existing_ip}" \
      --name="${DOMAIN}." \
      --ttl=300 \
      --type=A \
      --zone="${DNS_ZONE}" \
      --transaction-file="${txn_file}"
    gcloud dns record-sets transaction execute --zone="${DNS_ZONE}" --transaction-file="${txn_file}"
    rm -f "${txn_file}"
    echo "[INFO] DNS A record removed."
  else
    echo "[INFO] DNS A record not found. Skipping."
  fi
fi

if [[ "${cluster_exists}" == "true" ]]; then
  echo "[INFO] Deleting GKE cluster..."
  gcloud container clusters delete "${CLUSTER_NAME}" --zone "${ZONE}" --quiet
else
  echo "[INFO] GKE cluster already absent."
fi

echo "[INFO] Deleting global static IP (best effort)..."
if gcloud compute addresses describe "${STATIC_IP_NAME}" --global >/dev/null 2>&1; then
  if gcloud compute addresses delete "${STATIC_IP_NAME}" --global --quiet; then
    echo "[INFO] Static IP deleted."
  else
    echo "[WARN] Static IP delete failed. It may still be in-use."
    echo "[INFO] Check with:"
    echo "  gcloud compute addresses describe ${STATIC_IP_NAME} --global"
  fi
else
  echo "[INFO] Static IP not found. Skipping."
fi

echo "[INFO] Cleanup completed."
