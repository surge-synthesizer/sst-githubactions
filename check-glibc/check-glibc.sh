#!/usr/bin/env bash
# fails if any ELF in the given debs or directories needs a newer glibc than allowed
#   CHECK_GLIBC_PATHS  space separated .deb files or directories, globs expanded
#   CHECK_GLIBC_MAX    highest allowed glibc, e.g. 2.35
#   CHECK_GLIBCXX_MAX  optional highest allowed libstdc++ symbol version, e.g. 3.4.30
set -euo pipefail

max="${CHECK_GLIBC_MAX:-2.35}"
maxcxx="${CHECK_GLIBCXX_MAX:-}"
work="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/check-glibc"
rm -rf "$work"
mkdir -p "$work"

# true if $2 is a newer version than $1
newer() {
    [[ "$1" != "$2" && "$(printf '%s\n' "$1" "$2" | sort -V | tail -n1)" == "$2" ]]
}

n=0
# unquoted so globs expand
for p in ${CHECK_GLIBC_PATHS:?CHECK_GLIBC_PATHS is not set}; do
    if [[ ! -e "$p" ]]; then
        echo "::error::check-glibc: '$p' does not exist"
        exit 1
    fi
    n=$((n + 1))
    if [[ "$p" == *.deb ]]; then
        dpkg-deb -x "$p" "$work/$n"
    else
        mkdir -p "$work/$n"
        cp -R "$p" "$work/$n/"
    fi
done

nelf=0
bad=0
top=""
topcxx=""
while IFS= read -r -d '' f; do
    [[ "$(head -c4 "$f" | tr -d '\0')" == $'\x7fELF' ]] || continue
    nelf=$((nelf + 1))
    rel="${f#"$work"/*/}"
    syms=$(readelf -V -W "$f" | grep -oE 'GLIBC(XX)?_[0-9][0-9.]*' | sort -uV || true)
    g=$(grep '^GLIBC_' <<<"$syms" | tail -n1 || true)
    gx=$(grep '^GLIBCXX_' <<<"$syms" | tail -n1 || true)
    echo "$rel: ${g:-no glibc} ${gx}"

    if [[ -n "$g" ]]; then
        if newer "GLIBC_$max" "$g"; then
            echo "::error::$rel needs $g, the limit is GLIBC_$max"
            bad=1
        fi
        if [[ -z "$top" ]] || newer "$top" "$g"; then top="$g"; fi
    fi
    if [[ -n "$gx" ]]; then
        if [[ -n "$maxcxx" ]] && newer "GLIBCXX_$maxcxx" "$gx"; then
            echo "::error::$rel needs $gx, the limit is GLIBCXX_$maxcxx"
            bad=1
        fi
        if [[ -z "$topcxx" ]] || newer "$topcxx" "$gx"; then topcxx="$gx"; fi
    fi
done < <(find "$work" -type f -print0)

if ((nelf == 0)); then
    echo "::error::check-glibc: no ELF files in '$CHECK_GLIBC_PATHS'"
    exit 1
fi

summary="check-glibc: $nelf ELF files, highest ${top:-no glibc} (limit GLIBC_$max), highest ${topcxx:-no libstdc++}${maxcxx:+ (limit GLIBCXX_$maxcxx)}"
echo "$summary"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    echo "$summary" >>"$GITHUB_STEP_SUMMARY"
fi
exit $bad
