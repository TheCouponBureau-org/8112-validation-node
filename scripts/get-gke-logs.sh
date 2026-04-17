#!/usr/bin/env bash
set -euo pipefail

# Collect Kubernetes logs/debug artifacts for a namespace/workload.
# Usage:
#   ./scripts/get-gke-logs.sh [namespace] [app_label] [--follow] [--pattern "text"]
# Example:
#   ./scripts/get-gke-logs.sh coupon-app pos-validation-sdk

NAMESPACE="coupon-app"
APP_LABEL_VALUE="pos-validation-sdk"
FOLLOW_MODE="false"
PATTERN=""

# Backward-compatible positional parsing:
# 1st positional (optional): namespace
# 2nd positional (optional): app label value
if [[ "${1:-}" != "" && "${1:-}" != --* ]]; then
  NAMESPACE="$1"
  shift
fi
if [[ "${1:-}" != "" && "${1:-}" != --* ]]; then
  APP_LABEL_VALUE="$1"
  shift
fi

# Optional flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --follow)
      FOLLOW_MODE="true"
      shift
      ;;
    --pattern)
      shift
      PATTERN="${1:-}"
      if [[ -z "${PATTERN}" ]]; then
        echo "[ERROR] --pattern requires a value"
        exit 1
      fi
      shift
      ;;
    --pattern=*)
      PATTERN="${1#*=}"
      shift
      ;;
    *)
      echo "[WARN] Ignoring unknown argument: $1"
      shift
      ;;
  esac
done

APP_LABEL_KEY="app.kubernetes.io/name"
SELECTOR="${APP_LABEL_KEY}=${APP_LABEL_VALUE}"
TS="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="k8s-logs-${NAMESPACE}-${APP_LABEL_VALUE}-${TS}"

mkdir -p "${OUT_DIR}"

echo "[INFO] Namespace: ${NAMESPACE}"
echo "[INFO] Selector : ${SELECTOR}"
echo "[INFO] Output   : ${OUT_DIR}"
if [[ -n "${PATTERN}" ]]; then
  echo "[INFO] Pattern  : ${PATTERN}"
fi

echo "[INFO] Capturing cluster objects..."
kubectl get pods -n "${NAMESPACE}" -o wide > "${OUT_DIR}/pods.txt" || true
kubectl get deploy -n "${NAMESPACE}" -o wide > "${OUT_DIR}/deployments.txt" || true
kubectl get rs -n "${NAMESPACE}" -o wide > "${OUT_DIR}/replicasets.txt" || true
kubectl get svc -n "${NAMESPACE}" -o wide > "${OUT_DIR}/services.txt" || true
kubectl get ingress -n "${NAMESPACE}" -o wide > "${OUT_DIR}/ingress.txt" || true
kubectl get events -n "${NAMESPACE}" --sort-by=.lastTimestamp > "${OUT_DIR}/events.txt" || true

echo "[INFO] Capturing app logs (all matching pods)..."
kubectl logs -n "${NAMESPACE}" -l "${SELECTOR}" --all-containers=true --tail=1000 > "${OUT_DIR}/app-all-current.log" || true

PODS="$(kubectl get pods -n "${NAMESPACE}" -l "${SELECTOR}" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' || true)"

if [[ -z "${PODS}" ]]; then
  echo "[WARN] No pods found for selector: ${SELECTOR}"
else
  while IFS= read -r POD; do
    [[ -z "${POD}" ]] && continue

    SAFE_POD="${POD//\//_}"

    echo "[INFO] Capturing details for pod: ${POD}"
    kubectl describe pod "${POD}" -n "${NAMESPACE}" > "${OUT_DIR}/${SAFE_POD}-describe.txt" || true

    kubectl logs "${POD}" -n "${NAMESPACE}" --all-containers=true --tail=1000 > "${OUT_DIR}/${SAFE_POD}-current.log" || true

    # Previous container logs are useful for CrashLoopBackOff.
    kubectl logs "${POD}" -n "${NAMESPACE}" --all-containers=true --previous --tail=1000 > "${OUT_DIR}/${SAFE_POD}-previous.log" || true
  done <<< "${PODS}"
fi

echo "[INFO] Capturing deployment describe for matching deployments..."
DEPLOYS="$(kubectl get deploy -n "${NAMESPACE}" -l "${SELECTOR}" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' || true)"
if [[ -n "${DEPLOYS}" ]]; then
  while IFS= read -r DEP; do
    [[ -z "${DEP}" ]] && continue
    kubectl describe deploy "${DEP}" -n "${NAMESPACE}" > "${OUT_DIR}/${DEP}-describe.txt" || true
  done <<< "${DEPLOYS}"
fi

echo "[INFO] Done. Files written to: ${OUT_DIR}"
echo "[INFO] Tip: share ${OUT_DIR}/app-all-current.log and any *-previous.log for crash debugging."

if [[ -n "${PATTERN}" ]]; then
  echo "[INFO] Searching latest match for pattern..."
  LAST_MATCH=""
  HAS_RG="false"
  if command -v rg >/dev/null 2>&1; then
    HAS_RG="true"
  fi

  if [[ "${HAS_RG}" == "true" ]]; then
    LAST_MATCH="$(
      rg -nH --color never "${PATTERN}" \
        "${OUT_DIR}/app-all-current.log" \
        "${OUT_DIR}"/*-current.log \
        "${OUT_DIR}"/*-previous.log 2>/dev/null | tail -n 1 || true
    )"
  else
    LAST_MATCH="$(
      grep -nH -E "${PATTERN}" \
        "${OUT_DIR}/app-all-current.log" \
        "${OUT_DIR}"/*-current.log \
        "${OUT_DIR}"/*-previous.log 2>/dev/null | tail -n 1 || true
    )"
  fi

  if [[ -n "${LAST_MATCH}" ]]; then
    echo "${LAST_MATCH}" | tee "${OUT_DIR}/pattern-last-match.txt"
  else
    echo "NO_MATCH_FOUND" | tee "${OUT_DIR}/pattern-last-match.txt"
  fi
fi

if [[ "${FOLLOW_MODE}" == "true" ]]; then
  echo "[INFO] Starting continuous stream (Ctrl+C to stop)..."
  echo "[INFO] Streaming selector: ${SELECTOR} in namespace: ${NAMESPACE}"
  if [[ -n "${PATTERN}" && "${HAS_RG:-false}" == "true" ]]; then
    kubectl logs -n "${NAMESPACE}" -l "${SELECTOR}" \
      --all-containers=true \
      --timestamps=true \
      --prefix=true \
      -f | tee -a "${OUT_DIR}/app-live-follow.log" | rg --line-buffered "${PATTERN}"
  else
    kubectl logs -n "${NAMESPACE}" -l "${SELECTOR}" \
      --all-containers=true \
      --timestamps=true \
      --prefix=true \
      -f | tee -a "${OUT_DIR}/app-live-follow.log"
  fi
fi
