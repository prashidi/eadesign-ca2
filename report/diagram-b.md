# Diagram B - Request flow with correlation ID

```mermaid
sequenceDiagram
    participant C as Client
    participant I as Traefik Ingress
    participant G as Gateway
    participant K as KEDA Interceptor
    participant CH as checkout-fn
    participant P as pricing-fn
    participant INV as inventory-fn
    participant DB as PostgreSQL

    C->>I: POST /api/checkout\nX-Request-Id: prashidi-123
    I->>G: Route request
    G->>K: Forward /api/checkout
    K->>CH: Scale if needed and forward request
    CH->>P: POST /price\nX-Request-Id: prashidi-123
    CH->>INV: GET /stock/:sku\nX-Request-Id: prashidi-123
    P-->>CH: Price response
    INV-->>CH: Stock response
    CH->>DB: Insert checkout record
    CH-->>C: Checkout response