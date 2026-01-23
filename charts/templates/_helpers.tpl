{{/*
Expand the name of the chart.
*/}}
{{- define "dot-ai-ui.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "dot-ai-ui.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "dot-ai-ui.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "dot-ai-ui.labels" -}}
helm.sh/chart: {{ include "dot-ai-ui.chart" . }}
{{ include "dot-ai-ui.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "dot-ai-ui.selectorLabels" -}}
app.kubernetes.io/name: {{ include "dot-ai-ui.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the secret to use for auth token
*/}}
{{- define "dot-ai-ui.secretName" -}}
{{- if .Values.dotAi.auth.secretRef.name }}
{{- .Values.dotAi.auth.secretRef.name }}
{{- else }}
{{- include "dot-ai-ui.fullname" . }}-auth
{{- end }}
{{- end }}

{{/*
Create the key name for auth token in secret
*/}}
{{- define "dot-ai-ui.secretKey" -}}
{{- default "auth-token" .Values.dotAi.auth.secretRef.key }}
{{- end }}

{{/*
Create the name of the secret to use for UI auth token
*/}}
{{- define "dot-ai-ui.uiAuthSecretName" -}}
{{- if .Values.uiAuth.secretRef.name }}
{{- .Values.uiAuth.secretRef.name }}
{{- else }}
{{- include "dot-ai-ui.fullname" . }}-ui-auth
{{- end }}
{{- end }}

{{/*
Create the key name for UI auth token in secret
*/}}
{{- define "dot-ai-ui.uiAuthSecretKey" -}}
{{- default "ui-auth-token" .Values.uiAuth.secretRef.key }}
{{- end }}

{{/*
Merge global annotations with resource-specific annotations.
Resource-specific annotations take precedence over global annotations.
Usage: include "dot-ai-ui.annotations" (dict "global" .Values.annotations "local" .Values.ingress.annotations)
*/}}
{{- define "dot-ai-ui.annotations" -}}
{{- $global := .global | default dict -}}
{{- $local := .local | default dict -}}
{{- $merged := merge $local $global -}}
{{- if $merged -}}
{{- toYaml $merged -}}
{{- end -}}
{{- end -}}
