include .env	# WEBHOOK_URL
MYSQL_LOG := ./volume/mysql/log/slow.log


.PHONY: init
init	:
	@echo "リモート環境からDBの内容をローカルに落としてくる"
	bash init.sh env-monkey.ftt2306.dabaas.net monkey_ssh_key.pem

.PHONY: mysql
mysql	:
	@echo "mysqlのコンテナにアクセス"
	docker exec -it mysql bash

.PHONY: nginx
nginx	:
	@echo "nginxのコンテナにアクセス"
	docker exec -it nginx bash

.PHONY: run
run	:
	@echo "評価スクリプト(リストア・コンテナ再起動・マイグレーション・e2e テスト・負荷試験・採点)"
	@bash run.sh

.PHONY: migrate
migrate	:
	@echo "マイグレーション"
	@sudo truncate -s 0 ./volume/mysql/log/slow.log
	@cd ./benchmarker && bash migration.sh

.PHONY: restore
restore:
	@echo "リストア・マイグレーション"
	@sudo truncate -s 0 ./volume/mysql/log/slow.log
	@cd benchmarker && ./restore_and_migration.sh

.PHONY: bench
bench	:
	@echo "負荷試験 & 採点"
	@cd ./benchmarker && bash run_k6_and_score.sh

.PHONY: score
score	: migrate bench
	@echo "リストア & マイグレーション & 負荷試験 & 採点"

.PHONY: e2e
e2e	:
	@echo "e2e テスト"
	cd ./benchmarker && bash e2e.sh

.PHONY: deploy
deploy:
	@git pull
	@cd app && ./restart_container.sh

.PHONY: log
log:
	@sudo cat $(MYSQL_LOG) | pt-query-digest > /tmp/pt-query-digest.txt
	-@curl -X POST -F txt=@/tmp/pt-query-digest.txt $(WEBHOOK_URL) -s -o /dev/null
