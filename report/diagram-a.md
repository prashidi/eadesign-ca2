# Diagram A - System architecture (components + routing)

```mermaid
flowchart TD
    Client[Browser / curl] --> Ingress[Traefik Ingress]
    Ingress --> Gateway[gateway-svc / NGINX UI]

    Gateway --> Arch[/GET /api/arch/]
    Gateway --> Ping[/GET /api/ping/]

    Gateway --> CheckoutPath[/POST /api/checkout/]
    CheckoutPath --> Interceptor[KEDA HTTP Interceptor / Proxy]
    Interceptor --> HTTPScaledObject[HTTPScaledObject]
    HTTPScaledObject --> Checkout[checkout-svc / checkout-fn]

    Checkout --> Pricing[pricing-svc / pricing-fn]
    Checkout --> Inventory[inventory-svc / inventory-fn]
    Checkout --> Postgres[postgres-svc / PostgreSQL]

    Postgres --> PVC[PersistentVolumeClaim]

    Toolbox[Toolbox Pod] --> Checkout
    Toolbox --> Pricing
    Toolbox --> Inventory
    Toolbox --> Postgres
```