# EAD CA2 — Security, Observability & Testing

**Student:** Patrick Rashidi
**Module:** Enterprise Architecture Design — TU Dublin 2026
**Repository:** https://github.com/prashidi/eadesign-ca2

## Overview

This repository extends the CA1 cloud-native e-commerce platform with security hardening, observability improvements, and controlled security testing. The system is a nanoservices-based checkout platform deployed on Kubernetes (K3s).

## Services

| Service | Description | Port |
|---------|-------------|------|
| gateway | NGINX reverse proxy and UI | 80 |
| checkout-fn | Checkout logic, metrics endpoint | 3003 |
| pricing-fn | Tax calculation | 3001 |
| inventory-fn | Stock lookup | 3002 |
| postgres | Order persistence | 5432 |

## Repository Structure
k8s/manifests/ # Base Kubernetes manifests 
k8s/security/ # NetworkPolicy, ServiceAccounts, pod security 
k8s/observability/ # Prometheus and Grafana manifests 
testing/.reports/ # Trivy and kubesec scan outputs 
app/ # Node.js service source code 
report/ # CA2 report document

## Security Improvements

- Plaintext secret removed from version control
- NetworkPolicy enforcing default-deny with explicit allow rules
- Dedicated ServiceAccounts per service, token mounting disabled
- securityContext hardening on all containers
- Resource limits and requests on all workloads
- Structured JSON logging with pino

## Quick Start

```bash
# Create namespace and secret
kubectl create namespace ecommerce
kubectl create secret generic db-creds \
  --from-literal=username=postgres \
  --from-literal=password=<your-password> \
  -n ecommerce

# Build and import images
docker build -t ead/checkout-fn:v7 ./app/checkout
docker build -t ead/pricing-fn:v4 ./app/pricing
docker build -t ead/inventory-fn:v4 ./app/inventory
docker save ead/checkout-fn:v7 | sudo k3s ctr images import -
docker save ead/pricing-fn:v4 | sudo k3s ctr images import -
docker save ead/inventory-fn:v4 | sudo k3s ctr images import -

# Apply manifests
kubectl apply -f k8s/manifests/ -n ecommerce
kubectl apply -f k8s/security/ -n ecommerce
kubectl apply -f k8s/observability/ -n observability

# Test
curl -X POST http://localhost/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"sku": 1, "subtotal": 100}'
```

## Observability

- Prometheus: `http://<node-ip>:32001`
- Grafana: `http://<node-ip>:32000` (admin/admin123)
- Metrics endpoint: `GET /metrics` on checkout-fn

## Security Testing

```bash
# Trivy image scan
docker run --rm --dns 8.8.8.8 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e TRIVY_DB_REPOSITORY=ghcr.io/aquasecurity/trivy-db \
  aquasec/trivy:latest image ead/checkout-fn:v7

# kubesec manifest scan
curl -sSX POST --data-binary @k8s/security/03-pod-security.yaml \
  https://v2.kubesec.io/scan

# RBAC audit
kubectl auth can-i list secrets \
  --as=system:serviceaccount:ecommerce:sa-checkout -n ecommerce
```
