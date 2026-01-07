# ============================================================================
# POLO X - Scripts de Deploy Docker
# ============================================================================

# 1. BUILD DA IMAGEM
build-image:
	docker build -t polox-api:latest .

# 2. DESENVOLVIMENTO LOCAL (com Docker)
dev-docker:
	docker-compose up -d
	docker-compose logs -f

dev-docker-stop:
	docker-compose down

# 3. PRODUÇÃO (com Traefik)
prod-up:
	docker-compose -f docker-compose.prod.yml up -d

prod-down:
	docker-compose -f docker-compose.prod.yml down

prod-logs:
	docker-compose -f docker-compose.prod.yml logs -f

prod-restart:
	docker-compose -f docker-compose.prod.yml restart api

# 4. DEPLOY COMPLETO (build + push + deploy)
deploy-prod:
	docker build -t polox-api:latest .
	docker-compose -f docker-compose.prod.yml up -d

# 5. LIMPEZA
clean:
	docker system prune -f
	docker volume prune -f

# 6. LOGS
logs:
	docker logs -f polox-api-prod

# 7. SHELL NO CONTAINER
shell:
	docker exec -it polox-api-prod sh

# 8. RODAR MIGRATIONS NO CONTAINER
migrate:
	docker exec polox-api-prod node migrations/migration-runner.js up

# 9. VERIFICAR STATUS
status:
	docker ps | grep polox-api

.PHONY: build-image dev-docker dev-docker-stop prod-up prod-down prod-logs prod-restart deploy-prod clean logs shell migrate status
