# S13 Training Camps

A self-contained student training website that runs as one Docker container.

## Single-container architecture

The `app` container provides everything:

- Responsive HTML, CSS, and JavaScript website
- Course catalog API
- Student registration and login API
- Enrollment API
- File-based demo persistence through the `app-data` Docker volume

The application uses only the Node.js standard library and has no package dependencies. The GitHub Actions workflow builds the Docker image on every branch push using a GitHub-hosted Ubuntu runner, prints the image tag, ID, and size in the run log, then pushes the commit-SHA and `latest` tags to Docker Hub. It pulls the pushed image, starts a temporary container, checks the health and courses APIs, and shows the container status and logs in the Actions summary.

## Tools used

- HTML5, CSS3, and vanilla JavaScript
- Node.js 22
- Docker and Docker Compose
- GitHub Actions
- Git and curl

## Run

```bash
docker build -t s13-training-camps:latest .
docker volume create s13-training-camps-data
docker run -d --name s13-training-camps --restart unless-stopped -p 8080:8080 -v s13-training-camps-data:/data s13-training-camps:latest
```

Open <http://localhost:8080>.

## Verify

```bash
docker ps --filter name=s13-training-camps
curl http://localhost:8080/health
curl http://localhost:8080/api/courses
```

## Stop

```bash
docker rm -f s13-training-camps
```

Use `docker volume rm s13-training-camps-data` only when you intentionally want to delete saved demo users and enrollments.

## CI/CD

`.github/workflows/docker-build.yml` builds the image on every branch push using GitHub's hosted `ubuntu-24.04` runner, prints its tag, ID, and size, then pushes `devopseasylearning/s13-training-camps:<commit-sha>` and `devopseasylearning/s13-training-camps:latest` to Docker Hub. It pulls the SHA-tagged image, starts it in a temporary container on the runner, checks `/health` and `/api/courses`, and adds the container status and logs to the Actions summary. The container is not a persistent deployment. Configure a Docker Hub access token with write permission as the `DOCKERHUB_TOKEN` Actions repository secret. A local commit triggers no workflow until it is pushed; pull-request events alone do not trigger this push-only workflow.
