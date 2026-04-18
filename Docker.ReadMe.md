docker build -t thecouponbureau/pos-validation-sdk:v2 ./express_server

docker push thecouponbureau/pos-validation-sdk:v2

gcloud auth login

gcloud projects list

gcloud config set project f9cd701d-9220-4db2-80b
gcloud config set account abhijitiitg1@gmail.com

gcloud services enable container.googleapis.com compute.googleapis.com



gcloud container clusters create my-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-standard-2

# Destroy clsuter

gcloud container clusters delete my-cluster \
  --zone us-central1-a

# Delete Static IP

gcloud compute addresses list --global
gcloud compute addresses delete <STATIC_IP_NAME> --global


gcloud container clusters get-credentials my-cluster --zone us-central1-a --project project-22f2ce0f-25a9-4086-a7e


helm upgrade --install coupon-api ./helm/pos-validation-sdk \
  --namespace coupon-app \
  --create-namespace \
  --set image.repository=docker.io/thecouponbureau/pos-validation-sdk \
  --set image.tag=v1

kubectl get pods -n coupon-app


kubectl get svc -n coupon-app


kubectl get svc -n coupon-app


helm upgrade --install coupon-api ./helm/pos-validation-sdk \
  -n coupon-app \
  --set service.type=ClusterIP

gcloud compute addresses create coupon-api-ip --global


gcloud compute addresses describe coupon-api-ip --global --format="value(address)"


kubectl apply -f ingress-https.yaml

kubectl get ingress -n coupon-app
kubectl describe managedcertificate coupon-api-cert -n coupon-app

// Upgrade

# 1) Rebuild app image (includes /healthz route change), push new tag
docker build -t docker.io/thecouponbureau/pos-validation-sdk:v3 ./express_server
docker push docker.io/thecouponbureau/pos-validation-sdk:v3

# 2) Upgrade Helm release
helm upgrade --install coupon-api ./helm/pos-validation-sdk \
  -n coupon-app \
  --set image.repository=docker.io/thecouponbureau/pos-validation-sdk \
  --set image.tag=v3

# 3) Wait rollout
kubectl rollout status deploy/coupon-api-pos-validation-sdk -n coupon-app

# 4) Check pod image really updated
kubectl get deploy coupon-api-pos-validation-sdk -n coupon-app -o=jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'

# 5) Check app health from inside cluster
kubectl run curltest --rm -it --restart=Never -n coupon-app --image=curlimages/curl -- \
  curl -i http://coupon-api-pos-validation-sdk:3000/healthz



# For Mac

# Build correct amd64 image with latest fix
docker buildx build \
  --platform linux/amd64 \
  -t docker.io/thecouponbureau/pos-validation-sdk:v9 \
  --push \
  ./express_server

# Deploy
helm upgrade --install coupon-api ./helm/pos-validation-sdk \
  -n coupon-app \
  --set image.repository=docker.io/thecouponbureau/pos-validation-sdk \
  --set image.tag=v9 \
  --wait --timeout 10m

# Verify
kubectl get pods -n coupon-app
kubectl rollout status deploy/coupon-api-pos-validation-sdk -n coupon-app --timeout=10m
curl -i https://api.pos.thecouponbureau.org/healthz



# Read live logs

./scripts/get-gke-logs.sh coupon-app pos-validation-sdk --follow --pattern "Cannot read properties of undefined"