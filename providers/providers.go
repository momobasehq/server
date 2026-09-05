// Package providers is the set of payment adapters compiled into this server.
//
// Momobase registers none of its own, so this is the single place that decides
// which rails a build can execute. Adding an adapter is one line in All.
package providers

import (
	providerapi "github.com/momobasehq/momobase/providers"
	"github.com/momobasehq/momobase/providers/dummy"
)

// All returns the adapters this build ships with, keyed by the provider code an
// operator selects when creating a provider account through the Admin API.
//
// dummy is the in-tree simulator: deterministic, and it moves no money. It is
// registered so a fresh deployment can be exercised end to end before a real
// adapter exists. Drop it from this map for a build that must not run it.
func All() map[string]providerapi.Factory {
	return map[string]providerapi.Factory{
		"dummy": dummy.New,
	}
}
