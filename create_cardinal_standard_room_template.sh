#!/usr/bin/env bash
set -euo pipefail

: "${DOCUSEAL_API_URL:=https://docuseal.ink/api}"
: "${DOCUSEAL_API_KEY:?Set DOCUSEAL_API_KEY to a DocuSeal API token first}"

PDF_PATH="${1:-/Users/robinlefever/Downloads/Cardinal Standard Room Contract - 2026.pdf}"

if [[ ! -f "$PDF_PATH" ]]; then
  echo "PDF not found: $PDF_PATH" >&2
  exit 1
fi

PDF_BASE64="$(base64 -i "$PDF_PATH" | tr -d '\n')"

jq -n --arg file "$PDF_BASE64" '{
  name: "Cardinal Standard Room Contract - 2026",
  folder_name: "Clinic Contracts",
  external_id: "cardinal-standard-room-contract-2026",
  shared_link: false,
  documents: [
    {
      name: "Cardinal Standard Room Contract - 2026",
      file: $file,
      fields: [
        {
          name: "Patient Name",
          title: "Patient name",
          type: "text",
          role: "Payer",
          required: true,
          areas: [{ page: 4, x: 0.30, y: 0.746, w: 0.31, h: 0.026 }]
        },
        {
          name: "Patient Age",
          title: "Age",
          type: "number",
          role: "Payer",
          required: true,
          areas: [{ page: 4, x: 0.72, y: 0.746, w: 0.13, h: 0.026 }]
        },
        {
          name: "Payer Signature",
          title: "Payer signature",
          type: "signature",
          role: "Payer",
          required: true,
          areas: [{ page: 4, x: 0.30, y: 0.805, w: 0.38, h: 0.052 }]
        },
        {
          name: "Name of Signatory",
          title: "Name of signatory",
          type: "text",
          role: "Payer",
          required: true,
          areas: [{ page: 4, x: 0.30, y: 0.868, w: 0.38, h: 0.026 }]
        },
        {
          name: "Date of Signing",
          title: "Date of signing",
          type: "date",
          role: "Payer",
          required: true,
          preferences: { format: "DD/MM/YYYY" },
          areas: [{ page: 5, x: 0.30, y: 0.193, w: 0.28, h: 0.03 }]
        }
      ]
    }
  ]
}' | curl -sS -X POST "$DOCUSEAL_API_URL/templates/pdf" \
  -H "X-Auth-Token: $DOCUSEAL_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @- | jq .
