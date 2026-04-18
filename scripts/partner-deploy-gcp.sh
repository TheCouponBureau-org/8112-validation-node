#!/usr/bin/env bash
set -euo pipefail

# Interactive partner deployment for GKE + Helm.
# Flow:
# 1) Deploy app/service first
# 2) Reserve/show static IP for DNS
# 3) Pause until partner confirms DNS A record is set
# 4) Ask domain, apply ingress + managed certificate
# 5) Show next verification step

check_prereqs() {
  local missing=()
  local cmd=""
  for cmd in "$@"; do
    if ! command -v "${cmd}" >/dev/null 2>&1; then
      missing+=("${cmd}")
    fi
  done

  if [[ "${#missing[@]}" -gt 0 ]]; then
    echo "[ERROR] Missing required commands:"
    printf '  - %s\n' "${missing[@]}"
    echo "[INFO] Install the missing commands, then rerun this script."
    exit 1
  fi

  echo "[INFO] Prerequisite check passed."
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

ask_yes_no() {
  local prompt="$1"
  local default="${2:-y}"
  local answer=""
  local suffix="[y/N]"
  if [[ "${default}" == "y" ]]; then
    suffix="[Y/n]"
  fi
  read -r -p "${prompt} ${suffix}: " answer
  answer="${answer:-${default}}"
  [[ "${answer}" =~ ^[Yy]$ ]]
}

get_active_gcloud_account() {
  gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -n 1 || true
}

check_prereqs gcloud kubectl helm

WORK_DIR="$(pwd)"
STATE_FILE="${WORK_DIR}/deployment-state.env"
CONFIG_FILE="${WORK_DIR}/deployment-config.env"
BUNDLE_CONFIG_FILE=""
BUNDLE_HOME=""
BUNDLE_IMAGE_REPO=""
BUNDLE_IMAGE_TAG=""
BUNDLE_NAMESPACE=""
BUNDLE_RELEASE_NAME=""
BUNDLE_STATIC_IP_NAME=""
CFG_PROJECT_ID=""
CFG_CLUSTER_NAME=""
CFG_ZONE=""
CFG_NAMESPACE=""
CFG_RELEASE_NAME=""
CFG_IMAGE_REPO=""
CFG_IMAGE_TAG=""
CFG_STATIC_IP_NAME=""
CFG_DOMAIN=""
CFG_DNS_ZONE=""

for CANDIDATE_DIR in "${WORK_DIR}" "${WORK_DIR}/pos-validation-sdk-partner"; do
  if [[ -d "${CANDIDATE_DIR}/pos-validation-sdk" ]]; then
    BUNDLE_HOME="${CANDIDATE_DIR}"
    CHART_PATH="${CANDIDATE_DIR}/pos-validation-sdk"
    break
  fi
  TGZ_PATH="$(ls -1 "${CANDIDATE_DIR}"/pos-validation-sdk-*.tgz 2>/dev/null | head -n 1 || true)"
  if [[ -n "${TGZ_PATH}" ]]; then
    BUNDLE_HOME="${CANDIDATE_DIR}"
    CHART_PATH="${TGZ_PATH}"
    break
  fi
done

if [[ -z "${BUNDLE_HOME}" ]]; then
  echo "[ERROR] Could not find Helm chart directory or packaged chart in: ${WORK_DIR}"
  echo "[INFO] Expected one of:"
  echo "       - ./pos-validation-sdk"
  echo "       - ./pos-validation-sdk-<version>.tgz"
  echo "       - ./pos-validation-sdk-partner/pos-validation-sdk"
  echo "       - ./pos-validation-sdk-partner/pos-validation-sdk-<version>.tgz"
  exit 1
fi
BUNDLE_CONFIG_FILE="${BUNDLE_HOME}/bundle-config.env"

echo "[INFO] Partner GKE deploy script"
echo "[INFO] Chart source: ${CHART_PATH}"
echo "[INFO] Bundle home: ${BUNDLE_HOME}"

if [[ -f "${BUNDLE_CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${BUNDLE_CONFIG_FILE}"
  BUNDLE_IMAGE_REPO="${IMAGE_REPO:-}"
  BUNDLE_IMAGE_TAG="${IMAGE_TAG:-}"
  BUNDLE_NAMESPACE="${NAMESPACE:-}"
  BUNDLE_RELEASE_NAME="${RELEASE_NAME:-}"
  BUNDLE_STATIC_IP_NAME="${STATIC_IP_NAME:-}"
  echo "[INFO] Loaded bundle defaults from ${BUNDLE_CONFIG_FILE}"
fi

if [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE}"
  CFG_PROJECT_ID="${PROJECT_ID:-}"
  CFG_CLUSTER_NAME="${CLUSTER_NAME:-}"
  CFG_ZONE="${ZONE:-}"
  CFG_NAMESPACE="${NAMESPACE:-}"
  CFG_RELEASE_NAME="${RELEASE_NAME:-}"
  CFG_IMAGE_REPO="${IMAGE_REPO:-}"
  CFG_IMAGE_TAG="${IMAGE_TAG:-}"
  CFG_STATIC_IP_NAME="${STATIC_IP_NAME:-}"
  CFG_DOMAIN="${DOMAIN:-}"
  CFG_DNS_ZONE="${DNS_ZONE:-}"
  echo "[INFO] Loaded previous deploy config from ${CONFIG_FILE}"
fi

ACTIVE_ACCOUNT="$(get_active_gcloud_account)"
if [[ -n "${ACTIVE_ACCOUNT}" ]]; then
  echo "[INFO] gcloud is already authenticated as: ${ACTIVE_ACCOUNT}"
else
  echo "[WARN] No active gcloud authentication found."
  if ask_yes_no "Run 'gcloud auth login' now?" "y"; then
    gcloud auth login
    ACTIVE_ACCOUNT="$(get_active_gcloud_account)"
    if [[ -z "${ACTIVE_ACCOUNT}" ]]; then
      echo "[ERROR] gcloud auth is still not active after login."
      exit 1
    fi
    echo "[INFO] Authenticated as: ${ACTIVE_ACCOUNT}"
  else
    echo "[ERROR] gcloud authentication is required."
    exit 1
  fi
fi

PROJECT_ID="$(ask 'GCP Project ID' "${CFG_PROJECT_ID:-}")"
if [[ -z "${PROJECT_ID}" ]]; then
  echo "[ERROR] Project ID is required."
  exit 1
fi

CLUSTER_NAME="$(ask 'GKE Cluster Name' "${CFG_CLUSTER_NAME:-my-cluster}")"
ZONE="$(ask 'GKE Zone' "${CFG_ZONE:-us-central1-a}")"
NAMESPACE="$(ask 'Kubernetes Namespace' "${CFG_NAMESPACE:-${BUNDLE_NAMESPACE:-coupon-app}}")"
RELEASE_NAME="$(ask 'Helm Release Name' "${CFG_RELEASE_NAME:-${BUNDLE_RELEASE_NAME:-coupon-api}}")"
IMAGE_REPO="$(ask 'Docker image repository' "${CFG_IMAGE_REPO:-${BUNDLE_IMAGE_REPO:-docker.io/thecouponbureau/pos-validation-sdk}}")"
IMAGE_TAG="$(ask 'Docker image tag' "${CFG_IMAGE_TAG:-${BUNDLE_IMAGE_TAG:-latest}}")"
STATIC_IP_NAME="$(ask 'Global static IP resource name' "${CFG_STATIC_IP_NAME:-${BUNDLE_STATIC_IP_NAME:-coupon-api-ip}}")"

echo "[INFO] Using internal image tag: ${IMAGE_TAG}"
echo "[INFO] Reusing deploy config:"
echo "  PROJECT_ID=${PROJECT_ID}"
echo "  CLUSTER_NAME=${CLUSTER_NAME}"
echo "  ZONE=${ZONE}"
echo "  NAMESPACE=${NAMESPACE}"
echo "  RELEASE_NAME=${RELEASE_NAME}"
echo "  IMAGE_REPO=${IMAGE_REPO}"
echo "  IMAGE_TAG=${IMAGE_TAG}"
echo "  STATIC_IP_NAME=${STATIC_IP_NAME}"

echo "[INFO] Setting active project..."
gcloud config set project "${PROJECT_ID}" >/dev/null

echo "[INFO] Enabling required APIs..."
gcloud services enable container.googleapis.com compute.googleapis.com dns.googleapis.com >/dev/null

if ask_yes_no "Create cluster '${CLUSTER_NAME}' if it does not exist?" "n"; then
  if ! gcloud container clusters describe "${CLUSTER_NAME}" --zone "${ZONE}" >/dev/null 2>&1; then
    NODE_COUNT="$(ask 'Node count for new cluster' '3')"
    MACHINE_TYPE="$(ask 'Machine type for new cluster' 'e2-standard-2')"
    echo "[INFO] Creating cluster..."
    gcloud container clusters create "${CLUSTER_NAME}" \
      --zone "${ZONE}" \
      --num-nodes "${NODE_COUNT}" \
      --machine-type "${MACHINE_TYPE}"
  else
    echo "[INFO] Cluster already exists. Skipping create."
  fi
fi

echo "[INFO] Fetching cluster credentials..."
gcloud container clusters get-credentials "${CLUSTER_NAME}" --zone "${ZONE}" --project "${PROJECT_ID}"

echo "[INFO] Ensuring namespace exists..."
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

if ! gcloud compute addresses describe "${STATIC_IP_NAME}" --global >/dev/null 2>&1; then
  echo "[INFO] Creating global static IP '${STATIC_IP_NAME}'..."
  gcloud compute addresses create "${STATIC_IP_NAME}" --global
else
  echo "[INFO] Global static IP '${STATIC_IP_NAME}' already exists."
fi

STATIC_IP_VALUE="$(gcloud compute addresses describe "${STATIC_IP_NAME}" --global --format='value(address)')"
echo "[INFO] Static IP value: ${STATIC_IP_VALUE}"

GENERATED_VALUES="${WORK_DIR}/generated-values.yaml"
cat > "${GENERATED_VALUES}" <<EOF_VALUES
image:
  repository: ${IMAGE_REPO}
  tag: ${IMAGE_TAG}
EOF_VALUES

echo "[INFO] Deploying Helm release (app/service first)..."
helm upgrade --install "${RELEASE_NAME}" "${CHART_PATH}" \
  -n "${NAMESPACE}" \
  -f "${GENERATED_VALUES}"

echo
echo "[ACTION REQUIRED] DNS setup"
echo "1) Create an A record in your DNS provider."
echo "2) Point your chosen domain to this static IP: ${STATIC_IP_VALUE}"
echo "3) Wait until DNS resolves correctly."
echo

while true; do
  if ask_yes_no "Have you set the DNS A record?" "n"; then
    break
  fi
  echo "[INFO] DNS not confirmed yet. Configure DNS now, then press Enter to continue..."
  read -r
  echo
  echo "[INFO] Re-checking confirmation..."
done

DOMAIN="$(ask 'Enter the exact domain name you mapped (e.g. api.example.com)' "${CFG_DOMAIN:-}")"
if [[ -z "${DOMAIN}" ]]; then
  echo "[ERROR] Domain is required for ingress and certificate."
  exit 1
fi
DNS_ZONE="$(ask 'Cloud DNS managed zone (optional, used by destroy script)' "${CFG_DNS_ZONE:-}")"

if command -v dig >/dev/null 2>&1; then
  RESOLVED_IPS="$(dig +short "${DOMAIN}" A | tr '\n' ' ' | xargs || true)"
  if [[ -n "${RESOLVED_IPS}" ]]; then
    echo "[INFO] DNS currently resolves to: ${RESOLVED_IPS}"
    if [[ " ${RESOLVED_IPS} " != *" ${STATIC_IP_VALUE} "* ]]; then
      echo "[WARN] DNS does not yet resolve to expected static IP (${STATIC_IP_VALUE})."
      if ! ask_yes_no "Continue anyway?" "n"; then
        echo "[INFO] Aborting. Re-run when DNS points to ${STATIC_IP_VALUE}."
        exit 1
      fi
    fi
  else
    echo "[WARN] Could not resolve DNS yet for ${DOMAIN}."
    if ! ask_yes_no "Continue anyway?" "n"; then
      echo "[INFO] Aborting. Re-run after DNS propagation."
      exit 1
    fi
  fi
fi

GENERATED_INGRESS="${WORK_DIR}/generated-ingress-https.yaml"
cat > "${GENERATED_INGRESS}" <<EOF_INGRESS
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
EOF_INGRESS

echo "[INFO] Applying ingress + managed certificate..."
kubectl apply -f "${GENERATED_INGRESS}"

cat > "${STATE_FILE}" <<EOF_STATE
PROJECT_ID=${PROJECT_ID}
CLUSTER_NAME=${CLUSTER_NAME}
ZONE=${ZONE}
NAMESPACE=${NAMESPACE}
RELEASE_NAME=${RELEASE_NAME}
STATIC_IP_NAME=${STATIC_IP_NAME}
STATIC_IP_VALUE=${STATIC_IP_VALUE}
DOMAIN=${DOMAIN}
DNS_ZONE=${DNS_ZONE}
EOF_STATE

cat > "${CONFIG_FILE}" <<EOF_CFG
PROJECT_ID=${PROJECT_ID}
CLUSTER_NAME=${CLUSTER_NAME}
ZONE=${ZONE}
NAMESPACE=${NAMESPACE}
RELEASE_NAME=${RELEASE_NAME}
IMAGE_REPO=${IMAGE_REPO}
IMAGE_TAG=${IMAGE_TAG}
STATIC_IP_NAME=${STATIC_IP_NAME}
DOMAIN=${DOMAIN}
DNS_ZONE=${DNS_ZONE}
EOF_CFG

echo
echo "[INFO] Current resources:"
kubectl get pods,svc,ingress -n "${NAMESPACE}"
echo
echo "[INFO] Certificate status snapshot:"
kubectl describe managedcertificate coupon-api-cert -n "${NAMESPACE}" | sed -n '/Status:/,/Events:/p'
echo
echo "[NEXT] Run deployment validation script:"
echo "  ./partner-check-gcp-deployment.sh"
echo "[NEXT] State file saved for cleanup automation:"
echo "  ${STATE_FILE}"
echo "[NEXT] Persistent deploy config saved:"
echo "  ${CONFIG_FILE}"
echo "Then verify endpoint:"
echo "  curl -i https://${DOMAIN}/healthz"
