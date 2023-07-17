
nuke:
	docker-compose --profile all down --volumes
	docker-compose --profile all up --build -d
