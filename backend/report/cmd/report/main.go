package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"
	"runtime/debug"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"

	"lumana/report/gen/reportv1"
	"lumana/report/internal/report"
)

const maxMessageBytes = 16 << 20

func main() {
	port := os.Getenv("GRPC_PORT")
	if port == "" {
		port = "50051"
	}
	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("listen on :%s: %v", port, err)
	}

	server := grpc.NewServer(
		grpc.MaxSendMsgSize(maxMessageBytes),
		grpc.MaxRecvMsgSize(maxMessageBytes),
		grpc.UnaryInterceptor(recoverPanics),
	)
	reportv1.RegisterActivityReportServiceServer(server, report.NewServer())
	healthServer := health.NewServer()
	healthServer.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)
	healthpb.RegisterHealthServer(server, healthServer)
	reflection.Register(server)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		log.Print("shutting down")
		server.GracefulStop()
	}()

	log.Printf("report service listening on :%s", port)
	if err := server.Serve(listener); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

// a handler panic would otherwise exit the process; this turns it into an Internal error
func recoverPanics(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp any, err error) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("panic in %s: %v\n%s", info.FullMethod, r, debug.Stack())
			err = status.Error(codes.Internal, "internal error")
		}
	}()
	return handler(ctx, req)
}
