#!/usr/bin/env bash
set -euo pipefail

# Validate GKE + Helm deployment end-to-end:
# - cluster connectivity
# - pods readiness
# - service/ingress existence
# - managed certificate status
# - DNS A record points to expected static IP
# - HTTPS /healthz response

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

pass() {
  echo "[PASS] $1"
}

fail() {
  echo "[FAIL] $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

require_cmd gcloud
require_cmd kubectl
require_cmd curl
if ! command -v dig >/dev/null 2>&1 && ! command -v nslookup >/dev/null 2>&1; then
  echo "[ERROR] Missing DNS tool. Install 'dig' or 'nslookup'."
  exit 1
fi

FAIL_COUNT=0

WORK_DIR="$(pwd)"
STATE_FILE="${WORK_DIR}/deployment-state.env"
CONFIG_FILE="${WORK_DIR}/deployment-config.env"

if [[ -f "${STATE_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${STATE_FILE}"
  echo "[INFO] Loaded state from ${STATE_FILE}"
elif [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
  echo "[INFO] Loaded config from ${CONFIG_FILE}"
fi

PROJECT_ID="${PROJECT_ID:-}"
CLUSTER_NAME="${CLUSTER_NAME:-my-cluster}"
ZONE="${ZONE:-us-central1-a}"
NAMESPACE="${NAMESPACE:-coupon-app}"
RELEASE_NAME="${RELEASE_NAME:-coupon-api}"
STATIC_IP_NAME="${STATIC_IP_NAME:-coupon-api-ip}"
DOMAIN="${DOMAIN:-}"

if [[ -z "${PROJECT_ID}" ]]; then
  PROJECT_ID="$(ask 'GCP Project ID' '')"
fi
if [[ -z "${DOMAIN}" ]]; then
  DOMAIN="$(ask 'Domain name to verify (e.g. api.example.com)' '')"
fi

if [[ -z "${PROJECT_ID}" || -z "${DOMAIN}" ]]; then
  echo "[ERROR] Project ID and domain are required."
  exit 1
fi

echo "[INFO] Setting active project..."
gcloud config set project "${PROJECT_ID}" >/dev/null

echo "[INFO] Fetching cluster credentials..."
if gcloud container clusters get-credentials "${CLUSTER_NAME}" --zone "${ZONE}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  pass "Cluster credentials available"
else
  fail "Could not get cluster credentials"
fi

EXPECTED_IP=""
if EXPECTED_IP="$(gcloud compute addresses describe "${STATIC_IP_NAME}" --global --format='value(address)' 2>/dev/null)"; then
  if [[ -n "${EXPECTED_IP}" ]]; then
    pass "Static IP found: ${EXPECTED_IP}"
  else
    fail "Static IP '${STATIC_IP_NAME}' not found"
  fi
else
  fail "Static IP '${STATIC_IP_NAME}' not found"
fi

if kubectl get ns "${NAMESPACE}" >/dev/null 2>&1; then
  pass "Namespace exists: ${NAMESPACE}"
else
  fail "Namespace missing: ${NAMESPACE}"
fi

if kubectl get deploy "${RELEASE_NAME}-pos-validation-sdk" -n "${NAMESPACE}" >/dev/null 2>&1; then
  READY_REPLICAS="$(kubectl get deploy "${RELEASE_NAME}-pos-validation-sdk" -n "${NAMESPACE}" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || true)"
  DESIRED_REPLICAS="$(kubectl get deploy "${RELEASE_NAME}-pos-validation-sdk" -n "${NAMESPACE}" -o jsonpath='{.spec.replicas}' 2>/dev/null || true)"
  READY_REPLICAS="${READY_REPLICAS:-0}"
  DESIRED_REPLICAS="${DESIRED_REPLICAS:-0}"
  if [[ "${READY_REPLICAS}" == "${DESIRED_REPLICAS}" && "${DESIRED_REPLICAS}" != "0" ]]; then
    pass "Deployment ready (${READY_REPLICAS}/${DESIRED_REPLICAS})"
  else
    fail "Deployment not fully ready (${READY_REPLICAS}/${DESIRED_REPLICAS})"
  fi
else
  fail "Deployment missing: ${RELEASE_NAME}-pos-validation-sdk"
fi

if kubectl get svc "${RELEASE_NAME}-pos-validation-sdk" -n "${NAMESPACE}" >/dev/null 2>&1; then
  pass "Service exists: ${RELEASE_NAME}-pos-validation-sdk"
else
  fail "Service missing: ${RELEASE_NAME}-pos-validation-sdk"
fi

INGRESS_IP=""
if kubectl get ingress coupon-api-ingress -n "${NAMESPACE}" >/dev/null 2>&1; then
  INGRESS_IP="$(kubectl get ingress coupon-api-ingress -n "${NAMESPACE}" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)"
  if [[ -n "${INGRESS_IP}" ]]; then
    pass "Ingress exists with IP: ${INGRESS_IP}"
  else
    fail "Ingress exists but has no external IP yet"
  fi
else
  fail "Ingress missing: coupon-api-ingress"
fi

CERT_STATUS=""
if kubectl get managedcertificate coupon-api-cert -n "${NAMESPACE}" >/dev/null 2>&1; then
  CERT_STATUS="$(kubectl get managedcertificate coupon-api-cert -n "${NAMESPACE}" -o jsonpath='{.status.certificateStatus}' 2>/dev/null || true)"
  if [[ "${CERT_STATUS}" == "Active" ]]; then
    pass "Managed certificate is Active"
  else
    fail "Managed certificate status is '${CERT_STATUS:-unknown}'"
  fi
else
  fail "ManagedCertificate missing: coupon-api-cert"
fi

RESOLVED_IPS=""
if command -v dig >/dev/null 2>&1; then
  RESOLVED_IPS="$(dig +short "${DOMAIN}" A | tr '\n' ' ' | xargs || true)"
else
  RESOLVED_IPS="$(nslookup "${DOMAIN}" 2>/dev/null | awk '/^Address: /{print $2}' | tr '\n' ' ' | xargs || true)"
fi

if [[ -n "${RESOLVED_IPS}" ]]; then
  pass "DNS resolves: ${DOMAIN} -> ${RESOLVED_IPS}"
  if [[ -n "${EXPECTED_IP}" && " ${RESOLVED_IPS} " == *" ${EXPECTED_IP} "* ]]; then
    pass "DNS includes expected static IP (${EXPECTED_IP})"
  else
    fail "DNS does not include expected static IP (${EXPECTED_IP})"
  fi
else
  fail "DNS has no A record yet for ${DOMAIN}"
fi

HTTP_CODE="$(curl -sS -o /tmp/partner-health.out -w '%{http_code}' "https://${DOMAIN}/healthz" || true)"
if [[ "${HTTP_CODE}" == "200" ]]; then
  pass "HTTPS health check passed (200)"
else
  fail "HTTPS health check failed (status=${HTTP_CODE:-none})"
  echo "[INFO] Response preview:"
  sed -n '1,40p' /tmp/partner-health.out || true
fi

echo
if [[ "${FAIL_COUNT}" -eq 0 ]]; then
  echo "[RESULT] ALL CHECKS PASSED"
  exit 0
else
  echo "[RESULT] ${FAIL_COUNT} CHECK(S) FAILED"
  echo "[INFO] Run: kubectl get pods,svc,ingress -n ${NAMESPACE}"
  echo "[INFO] Run: kubectl describe managedcertificate coupon-api-cert -n ${NAMESPACE}"
  exit 1
fi
