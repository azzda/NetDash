# Deployment & CI/CD

NetDash ships as one container that serves the SPA, the HTTP API and the
WebSocket on a **single port / single origin** (`/ws`). That is what makes it
deployable behind one Ingress host, one Cloudflare tunnel route, or one
forward-auth proxy.

## Local

```bash
# dev (two terminals, HMR, Vite proxies /ws -> localhost:4000)
pnpm dev:backend
pnpm dev:frontend

# production-shaped container
docker compose up --build          # http://localhost:4000

# run the exact artifact CI published
NETDASH_IMAGE=ghcr.io/azzda/netdash:sha-abc1234 docker compose up
```

## Pipeline

```
PR ─► verify (format · lint · typecheck · test · build)
      └─► image: docker build + smoke test (/health, SPA, /ws upgrade)   [no push]

push main ─► verify ─► image ─► push ghcr.io/azzda/netdash:{sha-xxxxxxx, main, latest}
             └─► deploy-test: rewrite deploy/k8s/overlays/test newTag -> sha-xxxxxxx
                              commit back to main "[skip ci]"

git tag v0.2.0 ─► verify ─► image ─► push :{0.2.0, sha-xxxxxxx}
                  └─► deploy-prod: rewrite deploy/k8s/overlays/prod newTag -> 0.2.0
```

CI never has cluster credentials. It only moves an image tag in git; **Argo CD
in the homelab is the only thing that talks to Kubernetes**, which keeps the
blast radius of a leaked CI token to "can publish an image".

- `test` follows `main` automatically → `netdash-test.lab.azzda.cloud`
- `prod` only moves on an annotated release tag → `netdash.lab.azzda.cloud`
- rollback = `git revert` the tag-bump commit (or re-tag an older image)

## Kubernetes

```
deploy/k8s/
├── base/          deployment · service · ingress · baseline NetworkPolicy
└── overlays/
    ├── test/      namespace netdash-test, 1 replica, host netdash-test.lab.azzda.cloud
    └── prod/      namespace netdash,      2 replicas, host netdash.lab.azzda.cloud
deploy/argocd/     Argo CD Application manifests to copy into the azzdacloud repo
```

Render locally before pushing:

```bash
kubectl kustomize deploy/k8s/overlays/test
```

The pods run non-root with a read-only root filesystem, all capabilities
dropped and no service-account token mounted. TLS comes from the cluster
wildcard certificate (`wildcard-lab-azzda-cloud-tls`), reflected into both
namespaces — add `netdash-test` and `netdash` to the reflector namespace lists
in `platform/cert-issuers/wildcard-certificate.yaml` when installing.

## Homelab install (azzdacloud)

1. copy `deploy/argocd/netdash-test.yaml` and `netdash-prod.yaml` into
   `homelab-infra/3-gitops-core/apps/`
2. extend the reflector namespace lists on the wildcard certificate
3. commit + push to `origin/main` — the root app-of-apps picks them up
4. `netdash-test.lab.azzda.cloud` resolves via external-dns → Traefik
   (`10.0.30.200`)

> NetDash currently serves **mock data only**. Do not publish it through the
> Cloudflare tunnel until authentication is in place — see the roadmap in
> `PROGRESS.md`.
