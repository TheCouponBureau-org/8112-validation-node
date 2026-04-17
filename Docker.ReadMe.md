docker build -t <dockerhub-username>/pos-validation-sdk:v1 ./express_server

docker push <dockerhub-username>/pos-validation-sdk:v1

gcloud auth login

gcloud projects list

gcloud config set project f9cd701d-9220-4db2-80b
gcloud config set account abhijitiitg1@gmail.com

gcloud services enable container.googleapis.com compute.googleapis.com



gcloud container clusters create my-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-standard-2

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

