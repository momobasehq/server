package main

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

// zipWith builds an archive shaped like the one the release workflow publishes:
// flat, with the binary sitting beside the documentation.
func zipWith(t *testing.T, names ...string) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	for _, name := range names {
		f, err := w.Create(name)
		if err != nil {
			t.Fatalf("create %s: %v", name, err)
		}
		if _, err := f.Write([]byte("contents of " + name)); err != nil {
			t.Fatalf("write %s: %v", name, err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}
	return buf.Bytes()
}

// TestSumFor pins the parse against the exact SHA256SUMS the release job writes: a
// missing entry has to be an error rather than an empty string that matches nothing.
func TestSumFor(t *testing.T) {
	sums := []byte(
		"aaaa  momobase_v1.2.3_linux_amd64.zip\n" +
			"bbbb  momobase_v1.2.3_windows_arm64.zip\n")

	got, err := sumFor(sums, "momobase_v1.2.3_windows_arm64.zip")
	if err != nil || got != "bbbb" {
		t.Errorf("windows entry: got %q, %v", got, err)
	}
	if _, err := sumFor(sums, "momobase_v1.2.3_darwin_arm64.zip"); err == nil {
		t.Error("a file absent from SHA256SUMS must not resolve to a checksum")
	}
}

// TestBinaryFrom checks the binary is picked out of a flat archive that also
// carries the files the workflow copies in beside it.
func TestBinaryFrom(t *testing.T) {
	got, err := binaryFrom(zipWith(t, "README.md", binaryName(), "LICENSE.txt"))
	if err != nil {
		t.Fatalf("binaryFrom: %v", err)
	}
	if want := "contents of " + binaryName(); string(got) != want {
		t.Errorf("got %q, want %q", got, want)
	}

	if _, err := binaryFrom(zipWith(t, "README.md")); err == nil {
		t.Error("an archive without the binary must be an error")
	}
}

// TestReplace covers the swap itself: the new bytes land at the original path,
// executable, with no leftovers. A half-finished rename leaves no installed binary.
func TestReplace(t *testing.T) {
	dir := t.TempDir()
	exe := filepath.Join(dir, "momobase")
	if err := os.WriteFile(exe, []byte("old"), 0o755); err != nil {
		t.Fatalf("seed: %v", err)
	}

	if err := replace(exe, []byte("new")); err != nil {
		t.Fatalf("replace: %v", err)
	}

	got, err := os.ReadFile(exe)
	if err != nil || string(got) != "new" {
		t.Fatalf("after replace: got %q, %v", got, err)
	}
	info, err := os.Stat(exe)
	if err != nil {
		t.Fatalf("stat: %v", err)
	}
	if info.Mode().Perm()&0o111 == 0 {
		t.Errorf("installed binary is not executable: %v", info.Mode())
	}

	// The temporary file and the displaced binary both have to be gone, or every
	// update would litter the install directory.
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("readdir: %v", err)
	}
	if len(entries) != 1 || entries[0].Name() != "momobase" {
		t.Errorf("leftovers in the install directory: %v", entries)
	}
}
