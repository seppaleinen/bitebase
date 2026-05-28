# BiteBase — Kubernetes manifests

Reference manifests. Adapt to your cluster (ingress controller, storage class, secret management, registry).

## Files

| File | Purpose |
|---|---|
| `namespace.yaml` | `bitebase` namespace |
| `configmap.yaml` | Non-sensitive runtime config (URLs, model name) |
| `secret.yaml` | Sensitive config template — **do not commit real values** |
| `web-deployment.yaml` | Next.js Deployment + ClusterIP Service |
| `ollama-deployment.yaml` | Ollama Deployment + PVC + ClusterIP Service |
| `ingress.yaml` | nginx Ingress with TLS (cert-manager) |

## Quick apply

```bash
# 1. Create namespace first
kubectl apply -f k8s/namespace.yaml

# 2. Create secrets (fill in real values first, or use your secret manager)
kubectl create secret generic bitebase-secrets \
  --from-literal=DATABASE_URL='postgresql://user:pass@host:5432/bitebase' \
  --from-literal=BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  --from-literal=TAVILY_API_KEY='tvly-...' \
  -n bitebase

# 3. Apply everything else
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/ollama-deployment.yaml
kubectl apply -f k8s/web-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# 4. Pull a model into Ollama (first time only)
kubectl exec -n bitebase deploy/ollama -- ollama pull llama3.2

# 5. Watch rollout
kubectl rollout status deploy/bitebase-web -n bitebase
```

## Image

Build and push the image before applying:

```bash
docker build -t your-registry/bitebase-web:latest .
docker push your-registry/bitebase-web:latest
```

Then update the `image:` field in `web-deployment.yaml`.

## Database migrations

Migrations run automatically as an init container on every `bitebase-web` pod
start. This is safe because `drizzle-kit push` is idempotent.

For production you may prefer to run migrations as a separate Job before
updating the Deployment — swap the init container for a pre-deploy Job in your
CI pipeline.

## Skipping Ollama

Point `OLLAMA_BASE_URL` in `configmap.yaml` at any OpenAI-compatible endpoint:

```yaml
OLLAMA_BASE_URL: "https://api.openai.com/v1"
OLLAMA_MODEL: "gpt-4o-mini"
```

Add the API key to `secret.yaml` / your secret manager and mount it as
`OPENAI_API_KEY` (or the provider's equivalent). Then delete `ollama-deployment.yaml`.
