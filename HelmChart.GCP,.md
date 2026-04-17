# Helm + GCP (GKE) Deployment Guide

This guide explains how to deploy this app on **Google Kubernetes Engine (GKE)** with **Helm**, including:
- Docker image build/push
- Helm chart install/upgrade
- HTTPS endpoint with GKE Ingress
- DNS mapping
- Google-managed SSL certificate provisioning

It also includes how to share the chart with someone who does not have this workspace.

## 1) Prerequisites

Install and verify:
- `gcloud`
- `kubectl`
- `helm`
- `docker` (with `buildx`)

Auth and project:

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
```

Enable required APIs:

```bash
gcloud services enable \
  container.googleapis.com \
  compute.googleapis.com \
  artifactregistry.googleapis.com \
  dns.googleapis.com
```

Ensure project billing is enabled, otherwise GKE/API enablement will fail.

## 2) Build and Push Docker Image (DockerHub)

Use amd64 image for GKE default nodes.

```bash
TAG=v6

docker buildx build \
  --platform linux/amd64 \
  -t docker.io/thecouponbureau/pos-validation-sdk:${TAG} \
  --push \
  ./express_server
```

Recommendation: use a new immutable tag every release (`v7`, `v8`, timestamp, or git SHA).

## 3) Create GKE Cluster (One-Time)

```bash
gcloud container clusters create my-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-standard-2

# Configure kubectl context
gcloud container clusters get-credentials my-cluster \
  --zone us-central1-a \
  --project <PROJECT_ID>
```

## 4) Deploy App with Helm

Chart path in this repo:
- `helm/pos-validation-sdk`

Install/upgrade release:

```bash
kubectl create namespace coupon-app || true

helm upgrade --install coupon-api ./helm/pos-validation-sdk \
  --namespace coupon-app \
  --set image.repository=docker.io/thecouponbureau/pos-validation-sdk \
  --set image.tag=${TAG}
```

Verify:

```bash
kubectl get deploy,rs,pods,svc -n coupon-app
kubectl rollout status deploy/coupon-api-pos-validation-sdk -n coupon-app --timeout=10m
```

## 5) Expose One HTTPS Endpoint (Ingress + Managed Certificate)

### 5.1 Reserve a global static IP

```bash
gcloud compute addresses create coupon-api-ip --global

gcloud compute addresses describe coupon-api-ip --global --format='value(address)'
```

Save the returned IP as `STATIC_IP`.

### 5.2 Create DNS A record

Create/update DNS record:

- Host: `<YOUR_DOMAIN>`
- Type: `A`
- Value: `STATIC_IP`
- TTL: e.g. `300`

If using Cloud DNS, equivalent transaction flow:

```bash
# Example zone name only; replace with your zone
gcloud dns record-sets transaction start --zone=<DNS_ZONE>

gcloud dns record-sets transaction add <STATIC_IP> \
  --name="<YOUR_DOMAIN>." \
  --ttl=300 \
  --type=A \
  --zone=<DNS_ZONE>

gcloud dns record-sets transaction execute --zone=<DNS_ZONE>
```

### 5.3 Apply ingress + managed certificate

This repo already has:
- `ingress-https.yaml`

It contains:
- `ManagedCertificate` for your domain
- `Ingress` with static IP annotation `coupon-api-ip`
- Backend service `coupon-api-pos-validation-sdk:3000`

Before applying, update `ingress-https.yaml`:
- Replace host/domain values with `<YOUR_DOMAIN>`
- Keep static IP name aligned with your reserved global IP

Apply:

```bash
kubectl apply -f ingress-https.yaml
```

### 5.4 Check certificate provisioning

```bash
kubectl describe managedcertificate coupon-api-cert -n coupon-app
kubectl get ingress coupon-api-ingress -n coupon-app
```

Certificate states:
- `Provisioning`: normal during DNS propagation and LB setup
- `Active`: ready for HTTPS

Provisioning typically takes several minutes; DNS propagation can take longer.

## 6) Validate Endpoint

After cert is `Active`:

```bash
curl -i https://<YOUR_DOMAIN>/healthz
```

Expected:
- `HTTP 200`
- JSON health payload

If you see `502`, check:

```bash
kubectl get pods -n coupon-app
kubectl logs -n coupon-app deploy/coupon-api-pos-validation-sdk --tail=200
kubectl describe ingress coupon-api-ingress -n coupon-app
kubectl describe managedcertificate coupon-api-cert -n coupon-app
```

## 7) Share Helm Chart with Someone Else

If another user does not have this workspace, send packaged chart + ingress file.

Package chart:

```bash
helm package helm/pos-validation-sdk
```

Share these files:
- `pos-validation-sdk-0.1.0.tgz`
- `ingress-https.yaml` (if HTTPS/domain setup required)

What they run:

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
gcloud container clusters get-credentials <CLUSTER> --zone <ZONE> --project <PROJECT_ID>

kubectl create namespace coupon-app || true

helm upgrade --install coupon-api ./pos-validation-sdk-0.1.0.tgz \
  -n coupon-app \
  --set image.repository=docker.io/thecouponbureau/pos-validation-sdk \
  --set image.tag=v6

kubectl apply -f ingress-https.yaml
kubectl get pods,svc,ingress -n coupon-app
```

## 8) Upgrade to New Version

```bash
NEW_TAG=v7

# build + push

docker buildx build \
  --platform linux/amd64 \
  -t docker.io/thecouponbureau/pos-validation-sdk:${NEW_TAG} \
  --push \
  ./express_server

# helm upgrade
helm upgrade --install coupon-api ./helm/pos-validation-sdk \
  -n coupon-app \
  --set image.repository=docker.io/thecouponbureau/pos-validation-sdk \
  --set image.tag=${NEW_TAG}
```

## 9) Rollback

```bash
helm history coupon-api -n coupon-app
helm rollback coupon-api <REVISION> -n coupon-app
```

## 10) Useful Debug Commands

```bash
kubectl get all -n coupon-app
kubectl get events -n coupon-app --sort-by=.lastTimestamp | tail -n 100
kubectl logs -n coupon-app deploy/coupon-api-pos-validation-sdk --tail=200
```

For full bundle collection, use the script in this repo:

```bash
./scripts/get-gke-logs.sh coupon-app pos-validation-sdk --follow --pattern "error|invalid|exception"
```
