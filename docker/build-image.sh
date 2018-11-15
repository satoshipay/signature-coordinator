#!/usr/bin/env bash
# File to first build all dependencies in one container and then move then in a second so we do not leak
# NPM_AUTH_TOKEN to production releases.
set -e
while getopts r:t: option
do
        case "${option}"
        in
                r) REPO=${OPTARG};;
                t) TAG=${OPTARG};;
        esac
done

[[ -z "${REPO}" ]] && echo "missing repository argument -r" && exit 1
[[ -z "${TAG}" ]] && echo "missing tag argument -t" && exit 1

SCRIPT_DIR="$(dirname $0)"
BUILD_HASH="$(cat .version || git describe --always)"

# change to root so docker can find the files
cd ${SCRIPT_DIR}/..

docker build \
       --build-arg BUILD_HASH=${BUILD_HASH} \
       -t ${REPO}:${TAG} \
       -f ${SCRIPT_DIR}/Dockerfile .
