# Go backend: a small static binary on Alpine. Builds for whatever machine it
# runs on (x86 or the ARM machines of Oracle Cloud's free tier).
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/etms-backend .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -H app
COPY --from=build /out/etms-backend /usr/local/bin/etms-backend
USER app
EXPOSE 4000
ENTRYPOINT ["etms-backend"]
