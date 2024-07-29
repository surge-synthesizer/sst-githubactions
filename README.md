# sst-githubactions

This repo contains a set of shared github actions we use for automating
builds tests and so on.

The actions are

## `clang-format-check`

Runs clang-format on a collection of paths.  You basically copy it and 
configure the paths as a matrix. For instance

```yaml
jobs:
  formatting-check:
    name: Clang Format Check
    runs-on: ubuntu-latest
    strategy:
      matrix:
        path: [ 'src', 'src-ui', 'clients', 'tests' ]
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Run clang-format style check
        uses: surge-synthesizer/sst-githubactions/clang-format-check@main
        with:
          path: ${{ matrix.path }}
```

## `discord-release-notify`

Builds a notification of release to our discord, given a webhook.

## `prepare-for-juce`

Sets up a machine for a juce build. Has a 'gccversion' option to control
gcc on linux

## `publish-doxygen`

does the steps to publish one of our libraries doxygen setups to sst-docs

## `upload-to-release`

Does a release upload with build steps and release notes and so on, either
re-using a tag or creating one anew.