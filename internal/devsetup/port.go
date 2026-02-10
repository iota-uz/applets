//go:build !windows
// +build !windows

package devsetup

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"syscall"
)

// CheckPort verifies that the given port is free on both IPv4 and IPv6 loopback.
// On macOS, dev servers often bind ::1 (IPv6), so checking only 127.0.0.1 can
// incorrectly report "free" even when the port is taken.
func CheckPort(ctx context.Context, port int, label string) error {
	ln4, err4 := listenLoopback(ctx, "tcp4", port)
	ln6, err6 := listenLoopback(ctx, "tcp6", port)

	if ln4 != nil {
		_ = ln4.Close()
	}
	if ln6 != nil {
		_ = ln6.Close()
	}

	if isAddrInUse(err4) || isAddrInUse(err6) {
		fmt.Fprintf(os.Stderr, "ERROR: Port %d is already in use (%s)\n", port, label)
		fmt.Fprintf(os.Stderr, "  Kill it: lsof -ti :%d | xargs kill\n", port)
		return fmt.Errorf("port %d is in use", port)
	}
	if err4 != nil && !isAddrFamilyUnsupported(err4) {
		return err4
	}
	if err6 != nil && !isAddrFamilyUnsupported(err6) {
		return err6
	}
	return nil
}

// PickAvailablePort tries ports starting from start, returning the first free one.
func PickAvailablePort(ctx context.Context, start, attempts int) (int, error) {
	for p := start; p < start+attempts; p++ {
		if err := CheckPort(ctx, p, "Vite"); err == nil {
			return p, nil
		}
	}
	return 0, fmt.Errorf("no free port found in range %d-%d", start, start+attempts-1)
}

func listenLoopback(ctx context.Context, network string, port int) (net.Listener, error) {
	var addr string
	switch network {
	case "tcp4":
		addr = fmt.Sprintf("127.0.0.1:%d", port)
	case "tcp6":
		addr = fmt.Sprintf("[::1]:%d", port)
	default:
		addr = fmt.Sprintf(":%d", port)
	}
	lc := net.ListenConfig{}
	return lc.Listen(ctx, network, addr)
}

func isAddrInUse(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, syscall.EADDRINUSE)
}

func isAddrFamilyUnsupported(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, syscall.EAFNOSUPPORT) || errors.Is(err, syscall.EPROTONOSUPPORT)
}
