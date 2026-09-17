// Package providers is the set of payment adapters compiled into this server.
//
// Momobase registers none of its own, so this is the single place that decides
// which rails a build can execute. Adding an adapter is one line in All.
package providers

import (
	providerapi "github.com/momobasehq/momobase/providers"
	"github.com/momobasehq/momobase/providers/dummy"
	"github.com/momobasehq/providers/airtel"
	"github.com/momobasehq/providers/flutterwave"
	"github.com/momobasehq/providers/marzpay"
	"github.com/momobasehq/providers/mtn"
	"github.com/momobasehq/providers/yopayments"
)

// All returns the adapters this build ships with, keyed by the provider code an
// operator selects when creating a provider account through the Admin API.
//
// dummy is the in-tree simulator: deterministic, and it moves no money. It is
// registered so a fresh deployment can be exercised end to end before a real
// adapter exists. Drop it from this map for a build that must not run it.
//
// The rest come from github.com/momobasehq/providers. Registering one costs
// nothing at runtime: an adapter is constructed only when an operator creates a
// provider account for its code, and configured only from that account.
func All() map[string]providerapi.Factory {
	return map[string]providerapi.Factory{
		"dummy":       dummy.New,
		"mtn":         mtn.New,
		"airtel":      airtel.New,
		"yopayments":  yopayments.New,
		"marzpay":     marzpay.New,
		"flutterwave": flutterwave.New,
	}
}
