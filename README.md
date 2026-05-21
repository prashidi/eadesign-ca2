# Serverless-Style Nanoservices (Compose vs Kubernetes)

## Overview
This project implements a nanoservices-based checkout system using:

- pricing-fn (tax calculation)
- inventory-fn (stock availability)
- checkout-fn (composition service)
- gateway (NGINX UI + routing)
- PostgreSQL (persistent storage)
- KEDA (scale-to-zero HTTP autoscaling)

## Technologies
- Docker
- Kubernetes (K3s)
- Traefik Ingress
- KEDA HTTP Add-on
- Node.js (Express)
- PostgreSQL

## Architecture
The system uses a nanoservices architecture with synchronous communication:

Gateway → Checkout → Pricing + Inventory → PostgreSQL

## Key Features
- Scale-to-zero with KEDA
- Cold start measurement
- Request tracing using X-Request-Id
- Persistent storage using PVC
- Fault injection and troubleshooting

## Performance
- Cold checkout: ~7.9s
- Warm checkout: ~0.04s

## Running the project
Refer to the `k8s/manifests` directory for Kubernetes deployment.

## Author
Patrick Rashidi
# eadesign-ca2
