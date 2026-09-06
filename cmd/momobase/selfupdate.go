package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

// The release workflow publishes one flat zip per platform, named for the tag,
// alongside a SHA256SUMS covering every archive in the release. Both facts are
// what let this command find its download without listing the release's assets.
const (
	repo        = "momobasehq/server"
	latestAPI   = "https://api.github.com/repos/" + repo + "/releases/latest"
	downloadURL = "https://github.com/" + repo + "/releases/download/"
)

// One client for the API call and the archive alike. The timeout is generous
// because it also covers a ~25MB download on a slow link.
var httpClient = &http.Client{Timeout: 2 * time.Minute}

func newSelfUpdateCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "self-update",
		Short: "Replace this binary with the latest GitHub release",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			// An unstamped build has no baseline to compare against, so it would
			// reinstall on every run and overwrite whatever was built locally.
			if version == "dev" {
				return errors.New("self-update needs a released build, and this one carries no version")
			}
			// In a container the image is the update path: a swapped binary lives
			// only until the container is replaced.
			if _, err := os.Stat("/.dockerenv"); err == nil {
				return errors.New("this binary runs in a container: pull a newer image instead")
			}

			exe, err := os.Executable()
			if err != nil {
				return err
			}
			// The symlink, not its target, is what a package manager or a manual
			// install points at, and replacing the link itself would break it.
			if exe, err = filepath.EvalSymlinks(exe); err != nil {
				return err
			}
			// A permission failure has to surface before the download rather than
			// after it, so the directory is probed with the call replace will make.
			if err := probe(filepath.Dir(exe)); err != nil {
				return fmt.Errorf("cannot write to %s: %w", filepath.Dir(exe), err)
			}

			out := cmd.OutOrStdout()
			tag, err := latestTag()
			if err != nil {
				return err
			}
			// Only equality is checked: the releases page is the source of truth,
			// and any difference means this binary is not what it publishes.
			if tag == version {
				fmt.Fprintf(out, "momobase %s is already the latest release\n", version)
				return nil
			}

			fmt.Fprintf(out, "updating %s -> %s\n", version, tag)
			binary, err := download(tag)
			if err != nil {
				return err
			}
			if err := replace(exe, binary); err != nil {
				return err
			}
			// Restarting is left to whoever supervises the process. Swapping a
			// live server out from under its in-flight requests is not this
			// command's call to make.
			fmt.Fprintf(out, "installed %s at %s; restart momobase to run it\n", tag, exe)
			return nil
		},
	}
}

// assetName is the archive built for the platform this binary was compiled for,
// which is the only one it can meaningfully install.
func assetName(tag string) string {
	return fmt.Sprintf("momobase_%s_%s_%s.zip", tag, runtime.GOOS, runtime.GOARCH)
}

// binaryName is the entry inside that archive.
func binaryName() string {
	if runtime.GOOS == "windows" {
		return "momobase.exe"
	}
	return "momobase"
}

func latestTag() (string, error) {
	body, err := get(latestAPI)
	if err != nil {
		return "", err
	}
	var release struct {
		TagName string `json:"tag_name"`
	}
	if err := json.Unmarshal(body, &release); err != nil {
		return "", err
	}
	if release.TagName == "" {
		return "", errors.New("the latest release carries no tag")
	}
	return release.TagName, nil
}

// download fetches the release archive for this platform and returns the binary
// inside it, having checked the archive against the release's own checksums.
func download(tag string) ([]byte, error) {
	asset := assetName(tag)
	archive, err := get(downloadURL + tag + "/" + asset)
	if err != nil {
		return nil, err
	}
	sums, err := get(downloadURL + tag + "/SHA256SUMS")
	if err != nil {
		return nil, err
	}

	want, err := sumFor(sums, asset)
	if err != nil {
		return nil, err
	}
	// Checked before anything is written, so a truncated or tampered download
	// never reaches the disk as an executable. SHA256SUMS is unsigned, so this
	// covers a corrupted transfer rather than a compromised release.
	if got := sha256.Sum256(archive); hex.EncodeToString(got[:]) != want {
		return nil, fmt.Errorf("%s does not match its published checksum", asset)
	}
	return binaryFrom(archive)
}

func get(url string) ([]byte, error) {
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	// Without this a 404 page would be installed as the new binary.
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s: %s", url, resp.Status)
	}
	return io.ReadAll(resp.Body)
}

// sumFor returns the checksum SHA256SUMS records for one archive. The file is
// the `shasum -a 256` output the release job concatenates: hex, two spaces, and
// the bare file name.
func sumFor(sums []byte, name string) (string, error) {
	for _, line := range strings.Split(string(sums), "\n") {
		if sum, file, ok := strings.Cut(strings.TrimSpace(line), "  "); ok && file == name {
			return sum, nil
		}
	}
	return "", fmt.Errorf("%s is not listed in SHA256SUMS", name)
}

// binaryFrom pulls the executable out of the flat archive. Only the one exact
// name is read and no path from the archive is ever joined onto a local one, so
// a crafted entry has nowhere to escape to.
func binaryFrom(archive []byte) ([]byte, error) {
	r, err := zip.NewReader(bytes.NewReader(archive), int64(len(archive)))
	if err != nil {
		return nil, err
	}
	for _, f := range r.File {
		if f.Name != binaryName() {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		defer func() { _ = rc.Close() }()
		return io.ReadAll(rc)
	}
	return nil, fmt.Errorf("%s is missing from the archive", binaryName())
}

func probe(dir string) error {
	f, err := os.CreateTemp(dir, ".momobase-update-*")
	if err != nil {
		return err
	}
	_ = f.Close()
	return os.Remove(f.Name())
}

// replace swaps the running executable for the downloaded one. The temporary
// file is created beside its target so the rename stays on a single filesystem
// and is therefore atomic; writing to a temporary directory first would risk a
// cross-device failure with the old binary already moved aside.
func replace(exe string, binary []byte) error {
	tmp, err := os.CreateTemp(filepath.Dir(exe), ".momobase-update-*")
	if err != nil {
		return err
	}
	// Cleans up every path that fails before the rename below consumes it.
	defer func() { _ = os.Remove(tmp.Name()) }()

	if _, err := tmp.Write(binary); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmp.Name(), 0o755); err != nil {
		return err
	}

	// Windows refuses to overwrite the image of a running process but will
	// rename one, so the old binary is moved aside first everywhere rather than
	// only there.
	old := exe + ".old"
	_ = os.Remove(old)
	if err := os.Rename(exe, old); err != nil {
		return err
	}
	if err := os.Rename(tmp.Name(), exe); err != nil {
		// Put the working binary back rather than leave nothing installed.
		_ = os.Rename(old, exe)
		return err
	}
	// Fails on Windows while this process holds the image open, which is why the
	// removal above runs on the next update too.
	_ = os.Remove(old)
	return nil
}
