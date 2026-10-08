# Lumana home assignment

Senior full-stack home assignment:

- [`frontend/`](frontend/README.md): Angular app with typeahead NASA image search and polygon annotation.
- [`backend/`](backend/README.md): NestJS microservices A and B with MongoDB, Redis (TimeSeries, pub/sub), Swagger, and a Go gRPC service that renders the PDF report. Runs with Docker Compose.

The two parts are independent: the frontend calls the public NASA API directly.
